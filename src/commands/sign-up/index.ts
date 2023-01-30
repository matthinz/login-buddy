import getopts from "getopts";
import { Page } from "puppeteer";
import { until } from "../../dsl";
import { GlobalState } from "../../types";
import { CommandHooks } from "../types";
import { runFromPageFancy } from "../utils";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, signupOptionsParser } from "./types";

// I can never remember what urls are what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

export function parseOptions(
  args: string[],
  { programOptions: { baseURL } }: GlobalState
): SignupOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "signup") {
    return;
  }

  const raw = getopts(args, {
    alias: {
      useBackupCodes: ["use-backup-codes"],
    },
  });

  const parsed = signupOptionsParser.parse(raw);

  if (!parsed.success) {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
    return;
  }

  return {
    ...parsed.parsed,
    baseURL,
  };
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
    globalState: GlobalState,
    options: SignupOptions,
    hooks: CommandHooks<GlobalState>
  ): Promise<GlobalState> => {
    if (options.saml && !options.sp) {
      // --saml implies --sp
      options.sp = true;
    }

    if (!options.spUrl) {
      // Discover an SP url
      if (options.baseURL.hostname === "localhost") {
        if (options.saml) {
          // Use identity-saml-sinatra
          options.spUrl = new URL("http://localhost:4567");
        } else {
          // Use identity-oidc-sinatra
          options.spUrl = new URL("http://localhost:9292");
        }
      }
    }

    const initialState = {};

    const untilArg = options.until
      ? UNTIL_ALIASES[options.until] ?? options.until
      : undefined;

    const signUpState = await SIGN_UP_FLOW.run(
      initialState,
      { ...options, page },
      {
        ...hooks,
        shouldStop: untilArg ? until(untilArg) : () => false,
      }
    );

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
