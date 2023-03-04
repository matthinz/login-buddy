import totp from "totp-generator";
import { PluginOptions } from "../../types";
import { SignupState } from "../sign-up";

export function otpPlugin({ events, state }: PluginOptions) {
  events.on("command:otp", () => {
    const globalState = state.current();
    const { lastSignup } = globalState;

    if (!lastSignup) {
      throw new Error("No current signup");
    }

    const { code, newState } = getOtp(lastSignup);
    state.update({
      ...state.current(),
      lastSignup: newState,
    });

    console.log("Your code is %s", code);
  });
}

export function getOtp(signup: SignupState): {
  code: string;
  newState: SignupState;
} {
  let code: string | undefined;
  let newState = signup;

  if (signup.backupCodes) {
    const backupCodes = [...signup.backupCodes];
    code = backupCodes.shift();
    if (!code) {
      throw new Error("No more backup codes");
    }
    newState = {
      ...signup,
      backupCodes,
    };
  } else if (signup.totpCode) {
    code = totp(signup.totpCode);
  } else {
    throw new Error("No otp available.");
  }

  return { code, newState };
}
