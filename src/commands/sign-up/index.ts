import getopts from "getopts";
import { ensureCurrentPage } from "../../browser";
import { until } from "../../dsl";
import { GlobalState } from "../../types";
import { makeRunner } from "../utils";
import { SIGN_UP_FLOW } from "./flow";
import { SignupParameters, signupParametersParser } from "./types";

// I can never remember what urls what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

export function parse(args: string[]): SignupParameters | undefined {
  const cmd = args.shift();
  if (cmd !== "signup") {
    return;
  }

  const raw = getopts(args);

  const parsed = signupParametersParser.parse(raw);

  if (!parsed.success) {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
    return;
  }

  return parsed.parsed;
}

export const run = makeRunner(
  async (params: SignupParameters, globalState: GlobalState) => {
    const newGlobalState = await ensureCurrentPage(globalState);

    const { browser, page } = newGlobalState;

    if (!params.spUrl) {
      // Discover an SP url
      if (globalState.programOptions.baseURL.hostname === "localhost") {
        if (params.saml) {
          // Use identity-saml-sinatra
          params.spUrl = new URL("http://localhost:4567");
        } else {
          // Use identity-oidc-sinatra
          params.spUrl = new URL("http://localhost:9292");
        }
      }
    }

    const initialState = {};

    const runOptions = {
      ...globalState.programOptions,
      ...params,
      browser,
      page,
    };

    const untilArg = params.until
      ? UNTIL_ALIASES[params.until] ?? params.until
      : undefined;

    const state = await (untilArg
      ? SIGN_UP_FLOW.run(initialState, runOptions, until(untilArg))
      : SIGN_UP_FLOW.run(initialState, runOptions));

    const { email, password, backupCodes } = state;

    if (!(email && password && backupCodes)) {
      return newGlobalState;
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
);
