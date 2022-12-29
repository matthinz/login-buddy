import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";
import { GlobalState } from "../../types";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, signupOptionsParser } from "./types";

export type SignUpState = Awaited<ReturnType<typeof SIGN_UP_FLOW["run"]>>;

const REGEX = /^sign\s*up\b(.*)/i;

export function parse(line: string): SignupOptions | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  const raw = getopts(m[1].split(/\s+/), {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  const parsed = signupOptionsParser.parse(raw);

  if (!parsed.success) {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
    return;
  }

  return parsed.parsed;
}

export async function run(
  options: SignupOptions,
  globalState: GlobalState
): Promise<GlobalState> {
  const newGlobalState = await ensureCurrentPage(globalState);

  const { browser, page } = newGlobalState;

  if (!options.spUrl) {
    // Discover an SP url
    if (globalState.programOptions.baseURL.hostname === "localhost") {
      options.spUrl = new URL("http://localhost:9292");
    }
  }

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
