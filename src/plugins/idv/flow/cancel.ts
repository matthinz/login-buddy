import { createFlow } from "../../../dsl";
import { VerifyOptions } from "../types";

export const CANCEL_IDV_FLOW = createFlow<{}, Pick<VerifyOptions, "baseURL">>()
  .navigateTo("/verify")
  .click('a[href*="/verify/cancel"]')
  .expect("/verify/cancel")
  .submit('form[action*="/verify/session"] button[type=submit]');
