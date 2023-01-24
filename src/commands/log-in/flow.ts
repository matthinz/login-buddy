import { createFlow } from "../../dsl";
import { getOtp } from "../../state";
import { SignUpState } from "../../types";

export const LOG_IN = createFlow<SignUpState, {}>()
  .type('[name="user[email]"]', (state) => state.email)
  .type('[name="user[password]"]', (state) => state.password)
  .submit()

  .branch(
    // Enter a backup code
    (page) => new URL(page.url()).pathname === "/login/two_factor/backup_code",
    (flow) =>
      flow
        .expectUrl("/login/two_factor/backup_code")
        .evaluateAndModifyState(async (_page, state) => {
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
        .generate("code", (state: SignUpState) => getOtp(state).code)
        .type("input[autocomplete=one-time-code]", (state) => state.code)
        .submit(),
    (flow) => flow
  );
