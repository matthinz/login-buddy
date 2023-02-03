import totp from "totp-generator";
import { SignupState } from "./commands/sign-up";

export function getOtp(state: SignupState): {
  code: string;
  newState: SignupState;
} {
  if (state.backupCodes) {
    const backupCodes = [...state.backupCodes];
    const code = backupCodes.shift();
    if (!code) {
      throw new Error("No more backup codes available");
    }
    return {
      code,
      newState: {
        ...state,
        backupCodes,
      },
    };
  }

  if (state.totpCode) {
    return {
      code: totp(state.totpCode),
      newState: state,
    };
  }

  throw new Error("Can't get an OTP");
}
