import { createFlow } from "../../dsl";
import { SignupOptions } from "./types";

const DEFAULT_PASSWORD = "reallygoodpassword";

export const SIGN_UP_FLOW = createFlow<{}, SignupOptions>()
  .branch(
    (_page, _state, options) => options.sp,
    (useSp, _state, options) => {
      const { spUrl } = options;
      if (!spUrl) {
        throw new Error(
          "Signup via SP was requested but no SP url is available"
        );
      }
      return (
        useSp
          .navigateTo(spUrl)
          .select("[name=ial]", "2")
          .submit('form[action="/auth/request"] button[type=submit]')
          // Example Sinatra App is using Login.gov...
          .expectUrl("/")
          .click("#new_user .usa-button--outline")

          // "Create your account"
          .expectUrl("/sign_up/enter_email")
      );
    },
    (noSp) => noSp.navigateTo("/sign_up/enter_email")
  )
  .generate("email", generateEmail)
  .generate("password", () => DEFAULT_PASSWORD)
  .type('[name="user\\[email\\]"]', (state) => state.email)
  .click("label[for=user_terms_accepted]")
  .submit("button[type=submit]")

  .expectUrl("/sign_up/verify_email")
  .submit("#confirm-now")

  .expectUrl("/sign_up/enter_password")
  .type('[name="password_form\\[password\\]"]', (state) => state.password)
  .submit("button[type=submit]")

  .expectUrl("/authentication_methods_setup")
  .click("label[for=two_factor_options_form_selection_backup_code]")
  .submit("button[type=submit]")

  .expectUrl("/backup_code_setup")
  .submit("button[type=submit]")

  .expectUrl("/backup_code_setup")
  .evaluateAndModifyState(async (page, state) => {
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

  .expectUrl("/auth_method_confirmation")
  .submit('form[action="/auth_method_confirmation/skip"] button[type=submit]')

  .expectUrl("/account");

function generateEmail(): string {
  const now = new Date();
  return [
    "test-",
    now
      .toISOString()
      .replace(/\.\d+/, "")
      .replace(/(Z|[+-]\d+(:\d+)?)$/, "")
      .replace(/[:-]/g, "")
      .replace(/T/g, ""),
    "@example.org",
  ].join("");
}
