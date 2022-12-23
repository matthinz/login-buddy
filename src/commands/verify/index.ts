import getopts from "getopts";

import { CommandFunctions } from "../../types";
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
  const page = await getPage();
  await VERIFY_FLOW.run({
    baseURL: "http://localhost:3000",
    page: getPage,
    browser: getBrowser,
  });
}

export function runFromUserInput(
  line: string,
  funcs: CommandFunctions
): Promise<void> | undefined {
  const options = parse(line);
  return options ? run(options, funcs) : undefined;
}
