import totp from "totp-generator";

import { createFlow } from "../../dsl";
import { SignupOptions, SignupState } from "./types";

const DEFAULT_PASSWORD = "reallygoodpassword";

export const SIGN_UP_FLOW = createFlow<Partial<SignupState>, SignupOptions>()
  .generate("email", generateEmail)
  .generate("password", () => DEFAULT_PASSWORD)
  .generate("phone", () => "3602345678")

  .branch(
    (_page, _state, options) => !!options.sp,
    (useSp, _state, { sp }) => {
      if (!sp) {
        throw new Error(
          "Signup via SP was requested but no SP url is available"
        );
      }
      return (
        useSp
          .navigateTo(sp.url)
          .select("[name=ial]", "2")
          .submit("form button[type=submit]")
          // Example Sinatra App is using Login.gov...
          .expectUrl("/")
          .click("#new_user .usa-button--outline")

          // "Create your account"
          .expectUrl("/sign_up/enter_email")
      );
    },
    (noSp) => noSp.navigateTo("/sign_up/enter_email")
  )
  .type('[name="user\\[email\\]"]', (state) => state.email)
  .click("label[for=user_terms_accepted]")
  .submit("button[type=submit]")

  .expectUrl("/sign_up/verify_email")

  .branch(
    async (page) => !!(await page.$("#confirm-now")),
    // We can just confirm right away
    // This route is available when enable_load_testing_mode is set
    (flow) => flow.submit("#confirm-now"),

    // We have to click a link in an email
    (flow) =>
      flow
        .askIfNeeded(
          "confirmEmailToken",
          "Check your email and paste your confirmation link here",
          (token) => {
            token = (token ?? "").trim();

            try {
              const url = new URL(token);
              token = url.searchParams.get("confirmation_token") ?? "";
            } catch (err) {}

            return token;
          }
        )
        .navigateTo(
          (state) =>
            `/sign_up/email/confirm?confirmation_token=${state.confirmEmailToken}`
        )
  )

  .expectUrl("/sign_up/enter_password")
  .type('[name="password_form\\[password\\]"]', (state) => state.password)
  .submit("button[type=submit]")

  .expectUrl("/authentication_methods_setup")

  // Use backup codes
  .branch(
    (_page, _state, options) => options.twoFactor === "backup_codes",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_backup_code]")
        .submit("button[type=submit]")
        .expectUrl("/backup_code_setup")
        .submit("button[type=submit]")

        .expectUrl("/backup_code_setup")
        .evaluate(async (page, state) => {
          const backupCodes = await page.evaluate((): string[] => {
            return [].map.call(
              // @ts-ignore
              document.querySelectorAll("main code"),
              // @ts-ignore
              (el): string => el.innerText
            ) as string[];
          });

          return { ...state, backupCodes };
        })
        .submit('form[action="/backup_code_continue"] button[type=submit]')
  )

  // Use TOTP
  .branch(
    (_page, _state, options) => options.twoFactor === "totp",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_auth_app]")
        .submit("button[type=submit]")
        .expectUrl("/authenticator_setup")
        .type("input[name=name]", "Login Buddy")
        .evaluate(async (page, state) => {
          const code = (await page.evaluate(() => {
            // @ts-ignore
            return document.querySelector("#qr-code")?.innerText ?? "";
          })) as string;

          if (!code) {
            throw new Error("No OTP setup code on page");
          }

          return {
            ...state,
            totpCode: code.trim(),
          };
        })
        .type("input[autocomplete=one-time-code]", ({ totpCode }) =>
          totp(totpCode)
        )
        .submit()
  )

  // Use sms
  .branch(
    (_page, _state, options) => options.twoFactor === "sms",
    (flow) =>
      flow
        .click("label[for=two_factor_options_form_selection_phone]")
        .submit()

        .askIfNeeded("phone", "Please enter your actual phone number here")

        .type('input[name="new_phone_form[phone]"]', (state) => state.phone)
        .submit()

        .expectUrl(
          "/login/two_factor/sms?otp_make_default_number=&reauthn=false"
        )
        .evaluate(async (page, state) => {
          const otp = await page.$eval(
            "[autocomplete=one-time-code]",
            (el) => (el as HTMLInputElement).value
          );
          return {
            ...state,
            otp,
          };
        })
        .askIfNeeded("otp", "Enter the OTP you received here")

        .type("[autocomplete=one-time-code]", (state) => state.otp)
        .submit()
  )

  .expectUrl("/auth_method_confirmation")
  .submit('form[action="/auth_method_confirmation/skip"] button[type=submit]')

  .expectUrl("/account");

function generateEmail<State, Options extends SignupOptions>(
  _state: State,
  options: Options
): string {
  const [name, ...rest] = options.baseEmailAddress.split("@");
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
