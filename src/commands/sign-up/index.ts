import { ensureBrowserLaunched, ensureCurrentPage } from "../../browser";
import { GlobalState, ProgramOptions } from "../../types";
import { SIGN_UP_FLOW } from "./flow";

export type Options = {};

export type SignUpState = Awaited<ReturnType<typeof SIGN_UP_FLOW["run"]>>;

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
  globalState: GlobalState
): Promise<GlobalState> {
  const newGlobalState = await ensureCurrentPage(globalState);

  const { browser, page } = newGlobalState;

  const state = await SIGN_UP_FLOW.run(
    {},
    {
      ...globalState.programOptions,
      ...options,
      browser,
      page,
    }
  );

  console.log(
    `

Signup complete!
User: ${state.email}
Pass: ${state.password}
Backup codes:
  ${state.backupCodes.join("\n  ")}
  `.trimEnd()
  );

  return {
    ...newGlobalState,
    lastSignup: state,
  };
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
