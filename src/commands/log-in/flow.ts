import { createFlow } from "../../dsl";
import { getOtp } from "../../state";
import { SignUpState } from "../../types";

export const LOG_IN = createFlow<SignUpState, {}>()
  .type('[name="user[email]"]', (state) => state.email)
  .type('[name="user[password]"]', (state) => state.password)
  .submit()

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
  .submit();
