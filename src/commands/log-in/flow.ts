import { createFlow } from "../../dsl";

type State = {
  email: string;
  password: string;
  backupCodes: string[];
};

export const LOG_IN = createFlow<State, {}>()
  .type('[name="user[email]"]', (state) => state.email)
  .type('[name="user[password]"]', (state) => state.password)
  .submit()

  .expectUrl("/login/two_factor/backup_code")
  .evaluateAndModifyState(async (page, state) => {
    const backupCodes = [...state.backupCodes];
    const code = backupCodes.shift();

    if (!code) {
      throw new Error("no more codes");
    }

    return {
      ...state,
      code,
      backupCodes,
    };
  })
  .type(
    '[name="backup_code_verification_form[backup_code]"]',
    (state) => state.code
  )
  .submit();
