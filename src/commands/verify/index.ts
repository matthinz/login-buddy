import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";

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

  await VERIFY_FLOW.run(lastSignup, {
    ...globalState.programOptions,
    ...options,
    browser,
    page,
  });

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
