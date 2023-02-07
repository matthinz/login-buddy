import { createFlow, navigateTo } from "../../dsl";
import { getOtp } from "../../state";
import { SignupState } from "../sign-up";
import { LogInOptions } from "./types";

export const LOG_IN = createFlow<SignupState, LogInOptions>()
  .branch(
    (_p, _s, options) => !!options.sp,
    (flow) =>
      // Come from an SP
      flow
        .navigateTo((_, { sp }) => {
          if (!sp) {
            throw new Error("No SP");
          }
          return sp.url;
        })
        .select("[name=ial]", "2")
        .submit("form button[type=submit]")
  )

  .type('[name="user[email]"]', (state) => state.email)
  .type('[name="user[password]"]', (state) => state.password)
  .submit()

  .branch(
    // Enter a backup code
    (page) => new URL(page.url()).pathname === "/login/two_factor/backup_code",
    (flow) =>
      flow
        .expectUrl("/login/two_factor/backup_code")
        .evaluate(async (_page, state) => {
          const { code, newState } = getOtp(state);
          return {
            ...newState,
            code,
          };
        })
        .type(
          '[name="backup_code_verification_form[backup_code]"]',
          (state) => state.code
        )
        .submit(),
    (flow) => flow
  )

  // Enter an OTP
  .branch(
    (page) =>
      new URL(page.url()).pathname === "/login/two_factor/authenticator",
    (flow) =>
      flow
        .expectUrl("/login/two_factor/authenticator")
        .generate("code", (state: SignupState) => getOtp(state).code)
        .type("input[autocomplete=one-time-code]", (state) => state.code)
        .submit(),
    (flow) => flow
  );
