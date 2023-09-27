import chalk from "chalk";
import { FlowBuilderInterface, atPath, optionSet } from "../../../dsl";
import { VerifyOptions } from "../types";

export function tryToCaptureGpoOtp<State extends {}>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State & { gpoOtp?: string }, VerifyOptions> {
  return (
    flow
      .navigateTo("/verify/by_mail/enter_code")
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

        if (gpoOtp) {
          console.log(chalk.dim(`Captured GPO OTP ${gpoOtp}`));
        }

        return { ...state, gpoOtp };
      })
  );
}

export function enterGpoOtp<State extends {}>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State & { gpoOtp: string }, VerifyOptions> {
  return flow
    .generate("gpoOtp", async (): Promise<string> => {
      throw new Error("TODO: Prompt for GPO OTP");
    })
    .evaluate(async ({ frame, state }) => {
      await frame.evaluate(() => {
        const el = document.querySelector<HTMLInputElement>(
          '[name="gpo_verify_form[otp]"]'
        );
        if (el) {
          el.value = "";
        }
      });
      return state;
    })
    .type(
      '[name="gpo_verify_form[otp]"]',
      ({ state: { gpoOtp }, options: { throttleGpo } }) => {
        if (throttleGpo) {
          return "NOTAVALIDCODE";
        } else {
          return gpoOtp;
        }
      }
    )
    .submit()
    .when(optionSet("throttleGpo"), (flow) =>
      flow.when(atPath("/verify/by_mail/enter_code"), enterGpoOtp)
    );
}
