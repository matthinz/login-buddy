import totp from "totp-generator";
import { GlobalState } from "../types";
import { makeRunner } from "./utils";

type Parameters = {};

export function parse(args: string[]): Parameters | undefined {
  const cmd = args.shift();
  if (cmd !== "code") {
    return;
  }
  return {};
}

export const run = makeRunner(
  async (_params: Parameters, state: GlobalState) => {
    const { lastSignup } = state;
    if (!lastSignup) {
      throw new Error("No current signup");
    }

    let code: string | undefined;
    let newState: GlobalState = state;

    if (lastSignup.backupCodes) {
      const backupCodes = [...lastSignup.backupCodes];
      code = backupCodes.shift();

      if (!code) {
        throw new Error("No more backup codes");
      }

      newState = {
        ...state,
        lastSignup: {
          ...lastSignup,
          backupCodes,
        },
      };
    } else if (lastSignup.totpCode) {
      code = totp(lastSignup.totpCode);
    }

    console.log("Your code is %s", code);

    return newState;
  }
);
