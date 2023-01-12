import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";
import { until } from "../../dsl";

import { GlobalState, ProgramOptions } from "../../types";
import { VERIFY_FLOW } from "./flow";
import { VerifyOptions, verifyOptionsParser } from "./types";

const REGEX = /^verify\b(.*)/i;

export function parse(line: string): VerifyOptions | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  const raw = getopts(m[1].split(/\s+/), {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  const parsed = verifyOptionsParser.parse(raw);

  if (parsed.success) {
    return parsed.parsed;
  } else {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
  }
}

export async function run(
  options: VerifyOptions,
  globalState: GlobalState
): Promise<GlobalState> {
  const { lastSignup } = globalState;
  if (!lastSignup) {
    throw new Error("No signup");
  }

  const newGlobalState = await ensureCurrentPage(globalState);
  const { browser, page } = newGlobalState;

  const runOptions = {
    ...globalState.programOptions,
    ...options,
    browser,
    page,
  };

  if (options.until) {
    await VERIFY_FLOW.run(lastSignup, runOptions, until(options.until));
  } else {
    await VERIFY_FLOW.run(lastSignup, runOptions);
  }

  return globalState;
}

export function runFromUserInput(
  line: string,
  globalState: GlobalState
): Promise<GlobalState> | undefined {
  const options = parse(line);
  if (!options) {
    return;
  }
  return run(options, globalState);
}
