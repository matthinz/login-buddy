import totp from "totp-generator";
import { PluginOptions } from "../../types";

export function otpPlugin({ events, state }: PluginOptions) {
  events.on("command:otp", () => {
    const globalState = state.current();
    const { lastSignup } = globalState;

    if (!lastSignup) {
      throw new Error("No current signup");
    }

    let code: string | undefined;

    if (lastSignup.backupCodes) {
      const backupCodes = [...lastSignup.backupCodes];
      code = backupCodes.shift();
      if (!code) {
        throw new Error("No more backup codes");
      }
      state.update({
        ...globalState,
        lastSignup: {
          ...lastSignup,
          backupCodes,
        },
      });
    } else if (lastSignup.totpCode) {
      code = totp(lastSignup.totpCode);
    } else {
      throw new Error("No otp available.");
    }

    console.log("Your code is %s", code);
  });
}
