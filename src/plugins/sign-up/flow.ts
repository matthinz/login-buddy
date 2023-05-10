import totp from "totp-generator";

import { createFlow, selectorFound } from "../../dsl";
import { SignupOptions, SignupState } from "./types";

const DEFAULT_PASSWORD = "reallygoodpassword";

export const SIGN_UP_FLOW = createFlow<Partial<SignupState>, SignupOptions>()
  .generate("email", generateEmail)
  .generate("password", () => DEFAULT_PASSWORD)
  .generate("phone", generatePhone)

  .branch(
    ({ options }) => !!options.sp,

    // From an SP: Start at the OIDC Sinatra app
    (flow) =>
      flow
        .navigateTo(({ options: { sp } }) => {
          if (!sp) {
            throw new Error();
          }
          return sp.url;
        })
        .select("[name=ial]", "2")
        .submit("form button[type=submit]")
        // Example Sinatra App is using Login.gov...
        .expect("/")
        .click("#new_user .usa-button--outline")
        // "Create your account"
        .expect("/sign_up/enter_email"),

    // Not from an SP: Just start at the "enter email" screen
    (flow) => flow.navigateTo("/sign_up/enter_email")
  )

  .type('[name="user[email]"]', ({ state }) => state.email)
  .click("label[for=user_terms_accepted]")
  .submit("button[type=submit]")

  .expect("/sign_up/verify_email")

  .branch(
    selectorFound("#confirm-now"),

    // We can just confirm right away
    // This route is available when enable_load_testing_mode is set
    (flow) => flow.submit("#confirm-now"),

    // We have to click a link in an email
    (flow) =>
      flow
        .generate("confirmEmailToken", async (context) => {
          throw new Error("TODO: Prompt user for confirmEmailToken");
        })
        .navigateTo(
          ({ state: { confirmEmailToken } }) =>
            `/sign_up/email/confirm?confirmation_token=${encodeURIComponent(
              confirmEmailToken
            )}`
        )
  )

  .expect("/sign_up/enter_password")
  .type(
    '[name="password_form[password]"]',
    ({ state: { password } }) => password
  )

  // Re-enter password when field is present
  .when(
    async ({ frame }) =>
      !!(await frame.$('[name="password_form[password_confirmation]"]')),
    (flow) =>
      flow.type(
        '[name="password_form[password_confirmation]"]',
        ({ state: { password } }) => password
      )
  )

  .submit("button[type=submit]")

  .expect("/authentication_methods_setup")

  // Use backup codes
  .when(
    ({ options }) => options.twoFactor === "backup_codes",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_backup_code]")
        .submit("button[type=submit]")
        .expect("/backup_code_setup")
        .submit("button[type=submit]")
        .evaluate(async ({ frame, state }) => {
          const backupCodes = await frame.evaluate((): string[] => {
            return [].map.call(
              document.querySelectorAll<HTMLElement>("main code"),
              (el: HTMLElement): string => el.innerText
            ) as string[];
          });

          return { ...state, backupCodes };
        })
        .submit('form[action="/backup_code_continue"] button[type=submit]')
  )

  // Use TOTP
  .when(
    ({ options }) => options.twoFactor === "totp",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_auth_app]")
        .submit("button[type=submit]")
        .expect("/authenticator_setup")
        .type("input[name=name]", "Login Buddy")
        .evaluate(async ({ frame, state }) => {
          const code = (await frame.evaluate(() => {
            return (
              document.querySelector<HTMLElement>("#qr-code")?.innerText ?? ""
            );
          })) as string;

          if (!code) {
            throw new Error("No OTP setup code on page");
          }

          return {
            ...state,
            totpCode: code.trim(),
          };
        })
        .type("input[autocomplete=one-time-code]", ({ state }) =>
          totp(state.totpCode)
        )
        .submit("button[type=submit]")
  )

  // Use sms
  .when(
    ({ options }) => options.twoFactor === "sms",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_phone]")
        .submit()

        .generate("phone", async () => {
          throw new Error("TODO: Prompt user for phone number");
        })

        .type('input[name="new_phone_form[phone]"]', ({ state }) => state.phone)
        .submit()

        .expect("/login/two_factor/sms?otp_make_default_number=&reauthn=false")

        .evaluate(async ({ frame, state }) => {
          const otp = await frame.$eval(
            "[autocomplete=one-time-code]",
            (el) => (el as HTMLInputElement).value
          );
          return {
            ...state,
            otp,
          };
        })

        .generate("otp", async () => {
          throw new Error("TODO: Prompt user for OTP");
        })

        .type("[autocomplete=one-time-code]", ({ state: { otp } }) => otp)
        .submit()
  )

  .expect("/auth_method_confirmation")
  .submit('form[action="/auth_method_confirmation/skip"] button[type=submit]')

  .branch(
    ({ options }) => !!options.sp,
    (flow) => flow,
    // If not coming from an SP we don't expect to start IDV yet
    (flow) => flow.expect("/account")
  );

function generateEmail({ options }: { options: SignupOptions }): string {
  const [name, ...rest] = options.baseEmail.split("@");
  const now = new Date();

  return [
    name,
    "+",
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "-",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
    "@",
    rest.join("@"),
  ].join("");
}

function generatePhone({
  state,
  options,
}: {
  state: { phone?: any };
  options: SignupOptions;
}): string {
  let { phone } = state;

  let digits = String(phone ?? "").replace(/[^\d]/g, "");

  if (digits.length >= 10) {
    return phone; // use original input if it looks ok-ish
  }

  if (digits.length === 0) {
    digits = options.basePhone;
  }

  while (digits.length < 10) {
    digits += String(Math.floor(Math.random() * 10));
  }

  return digits;
}
