import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";
import { until } from "../../dsl";
import { GlobalState } from "../../types";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, signupOptionsParser } from "./types";

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

  const initialState = {};

  const runOptions = {
    ...globalState.programOptions,
    ...options,
    browser,
    page,
  };

  const state = await (options.until
    ? SIGN_UP_FLOW.run(initialState, runOptions, until(options.until))
    : SIGN_UP_FLOW.run(initialState, runOptions));

  const { email, password, backupCodes } = state;

  if (!(email && password && backupCodes)) {
    return globalState;
  }

  console.log(
    `

Signup complete!
User: ${email}
Pass: ${password}
Backup codes:
  ${backupCodes.join("\n  ")}
  `.trimEnd()
  );

  return {
    ...newGlobalState,
    lastSignup: {
      ...state,
      email,
      password,
      backupCodes,
    },
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
