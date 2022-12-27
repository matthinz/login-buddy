import getopts from "getopts";

import { CommandFunctions, ProgramOptions } from "../../types";
import { VERIFY_FLOW } from "./flow";
import { Options, optionsParser } from "./types";

const REGEX = /^verify\b(.*)/i;

export function parse(line: string): Options | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  const raw = getopts(m[1].split(/\s+/), {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  const parsed = optionsParser.parse(raw);

  if (parsed.success) {
    return parsed.parsed;
  } else {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
  }
}

export async function run(
  options: Options,
  { getBrowser, getPage }: CommandFunctions
): Promise<void> {
  await VERIFY_FLOW.run({
    ...options,
    page: getPage,
    browser: getBrowser,
  });
}

export function runFromUserInput(
  line: string,
  funcs: CommandFunctions,
  programOptions: ProgramOptions
): Promise<void> | undefined {
  const options = parse(line);
  if (!options) {
    return;
  }
  return run(
    {
      ...programOptions,
      ...options,
    },
    funcs
  );
}
