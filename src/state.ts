import totp from "totp-generator";
import { SignUpState } from "./types";

export function getOtp(state: SignUpState): {
  code: string;
  newState: SignUpState;
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
