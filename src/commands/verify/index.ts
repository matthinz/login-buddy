import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";
import { until } from "../../dsl";

import { GlobalState, ProgramOptions } from "../../types";
import { makeRunner } from "../utils";
import { VERIFY_FLOW } from "./flow";
import { VerifyParameters, verifyParametersParser } from "./types";

export function parse(args: string[]): VerifyParameters | undefined {
  const cmd = args.shift();
  if (cmd !== "verify") {
    return;
  }

  const raw = getopts(args, {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  const parsed = verifyParametersParser.parse(raw);

  if (parsed.success) {
    return parsed.parsed;
  } else {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
  }
}

export const run = makeRunner(
  async (params: VerifyParameters, globalState: GlobalState) => {
    const { lastSignup } = globalState;
    if (!lastSignup) {
      throw new Error("No signup");
    }

    const newGlobalState = await ensureCurrentPage(globalState);
    const { browser, page } = newGlobalState;

    const runOptions = {
      ...globalState.programOptions,
      ...params,
      browser,
      page,
    };

    if (params.until) {
      await VERIFY_FLOW.run(lastSignup, runOptions, until(params.until));
    } else {
      await VERIFY_FLOW.run(lastSignup, runOptions);
    }

    return newGlobalState;
  }
);
