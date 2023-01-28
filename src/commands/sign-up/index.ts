import chalk from "chalk";
import getopts from "getopts";
import { Browser, Page } from "puppeteer";
import { until } from "../../dsl";
import { GlobalState } from "../../types";
import { runFromPage, runFromPageFancy } from "../utils";
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

  const raw = getopts(args, {
    alias: {
      useBackupCodes: ["use-backup-codes"],
    },
  });

  const parsed = signupParametersParser.parse(raw);

  if (!parsed.success) {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
    return;
  }

  return parsed.parsed;
}

export const run = runFromPageFancy(
  [
    async (page, state) => {
      return (
        new URL(page.url()).hostname === state.programOptions.baseURL.hostname
      );
    },
  ],
  (browser) => browser.newPage(),
  async (
    page: Page,
    params: SignupParameters,
    globalState: GlobalState
  ): Promise<GlobalState> => {
    if (params.saml && !params.sp) {
      // --saml implies --sp
      params.sp = true;
    }

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
      warn: (message: string) => {
        console.error(chalk.dim(message));
      },
      page,
    };

    const untilArg = params.until
      ? UNTIL_ALIASES[params.until] ?? params.until
      : undefined;

    const signUpState = await (untilArg
      ? SIGN_UP_FLOW.run(initialState, runOptions, until(untilArg))
      : SIGN_UP_FLOW.run(initialState, runOptions));

    const { email, password } = signUpState;
    let backupCodes =
      "backupCodes" in signUpState ? signUpState.backupCodes : undefined;
    let totpCode = "totpCode" in signUpState ? signUpState.totpCode : undefined;

    if (!(email && password && (backupCodes || totpCode))) {
      return globalState;
    }

    console.log(
      `

Signup complete!
User: ${email}
Pass: ${password}`
    );

    if (backupCodes) {
      console.log("Backup codes: %s", (backupCodes ?? []).join("\n  "));

      return {
        ...globalState,
        lastSignup: {
          ...signUpState,
          email,
          password,
          backupCodes,
          totpCode: undefined,
        },
      };
    } else if (totpCode) {
      return {
        ...globalState,
        lastSignup: {
          ...signUpState,
          email,
          password,
          backupCodes: undefined,
          totpCode,
        },
      };
    } else {
      return globalState;
    }
  }
);
