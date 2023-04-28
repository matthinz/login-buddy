import { createFlow } from "../../dsl/v2";
import { getOtp } from "../otp";
import { SignupState } from "../sign-up";
import { LogInOptions } from "./types";

export const LOG_IN = createFlow<SignupState, LogInOptions>()
  .when(
    ({ options }) => !!options.sp,
    (flow) =>
      // Come from an SP
      flow
        .navigateTo(({ options: { sp } }) => {
          if (!sp) {
            throw new Error("No SP");
          }
          return sp.url;
        })
        .select("[name=ial]", "2")
        .submit("form button[type=submit]")
  )

  .type('[name="user[email]"]', ({ state: { email } }) => email)
  .type('[name="user[password]"]', ({ state: { password } }) => password)
  .submit()

  .branch(
    // Enter a backup code
    ({ page }) =>
      new URL(page.url()).pathname === "/login/two_factor/backup_code",
    (flow) =>
      flow
        .expect("/login/two_factor/backup_code")
        .evaluate(async ({ state }) => {
          const { code, newState } = getOtp(state);
          return {
            ...newState,
            code,
          };
        })
        .type(
          '[name="backup_code_verification_form[backup_code]"]',
          ({ state: { code } }) => code
        )
        .submit(),
    (flow) => flow
  )

  // Enter an OTP
  .when(
    ({ page }) =>
      new URL(page.url()).pathname === "/login/two_factor/authenticator",
    (flow) =>
      flow
        .expect("/login/two_factor/authenticator")
        .generate("code", ({ state }) => getOtp(state).code)
        .type(
          "input[autocomplete=one-time-code]",
          ({ state: { code } }) => code
        )
        .submit()
  );
