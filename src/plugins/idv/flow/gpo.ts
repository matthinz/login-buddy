import { FlowBuilderInterface } from "../../../dsl";
import { VerifyOptions } from "../types";

export function enterGpoOtp<State extends {}>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State & { gpoOtp: string }, VerifyOptions> {
  return (
    flow
      .expect("/verify/come_back_later")
      .navigateTo("/account/verify")
      // "Welcome back"
      .evaluate(async ({ frame, state }) => {
        // Locally, IDP will put the OTP on the page for us to read.
        let gpoOtp = await frame.evaluate(() => {
          const otpInput = document.querySelector(
            '[name="gpo_verify_form[otp]"]'
          ) as HTMLInputElement | undefined;

          if (!otpInput) {
            return;
          }

          const result = otpInput.value;
          otpInput.value = "";

          return result;
        });

        return { ...state, gpoOtp };
      })
      .generate("gpoOtp", async (): Promise<string> => {
        throw new Error("TODO: Prompt for GPO OTP");
      })
      .type('[name="gpo_verify_form[otp]"]', ({ state: { gpoOtp } }) => gpoOtp)
      .submit()
  );
}
