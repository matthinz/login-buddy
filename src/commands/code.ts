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
  async (params: Parameters, state: GlobalState) => {
    const { lastSignup } = state;
    if (!lastSignup) {
      throw new Error("No current signup");
    }

    const backupCodes = [...lastSignup.backupCodes];
    const code = backupCodes.shift();

    if (!code) {
      throw new Error("No more backup codes");
    }

    console.log("Your code is %s", code);

    return {
      ...state,
      lastSignup: {
        ...lastSignup,
        backupCodes,
      },
    };
  }
);
