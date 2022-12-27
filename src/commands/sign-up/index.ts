import { CommandFunctions, ProgramOptions } from "../../types";
import { SIGN_UP_FLOW } from "./flow";

export type Options = {};

const REGEX = /^sign\s*up\b(.*)/i;

export function parse(line: string): Options | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  return {};
}

export async function run(
  options: Options,
  { getBrowser, getPage }: CommandFunctions
): Promise<void> {
  const state = await SIGN_UP_FLOW.run({
    ...options,
    page: getPage,
    browser: getBrowser,
  });

  console.log(
    `

Signup complete!
User: ${state.email}
Pass: ${state.password}
Backup codes:
  ${state.backupCodes.join("\n  ")}
  `.trimEnd()
  );
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
