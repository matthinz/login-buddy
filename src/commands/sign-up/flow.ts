import { navigateTo } from "../../dsl";

const DEFAULT_PASSWORD = "reallygoodpassword";

export const SIGN_UP_FLOW = navigateTo("/sign_up/enter_email")
  .generate("email", () => {
    const now = new Date();
    return [
      "test-",
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      "-",
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      "@example.org",
    ].join("");
  })
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
