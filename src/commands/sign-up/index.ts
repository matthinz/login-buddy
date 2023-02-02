import getopts from "getopts";
import { Page } from "puppeteer";
import { until } from "../../dsl";
import { GlobalState } from "../../types";
import { CommandHooks } from "../types";
import { runFromPageFancy } from "../utils";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, SpMethod, TwoFactorMethod } from "./types";

// I can never remember what urls are what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

const SP_URLS_BY_ENVIRONMENT: { [key: string]: { [key: string]: string } } = {
  local: {
    oidc: "http://localhost:4567", // identity-oidc-sinatra
    saml: "http://localhost:9292", // identity-saml-sinatra
  },
  dev: {
    oidc: "https://dev-identity-oidc-sinatra.app.cloud.gov/",
    saml: "https://dev-identity-saml-sinatra.app.cloud.gov/",
  },
  int: {
    oidc: "https://int-identity-oidc-sinatra.app.cloud.gov/",
    saml: "https://int-identity-saml-sinatra.app.cloud.gov/",
  },
};

export function parseOptions(
  args: string[],
  { programOptions: { baseURL, environment } }: GlobalState
): SignupOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "signup") {
    return;
  }

  const raw = getopts(args, {
    alias: {
      backupCodes: ["backup-codes", "use-backup-codes"],
      sms: ["use-sms"],
      totp: ["use-totp"],
    },
  });

  const sp = resolveSpOptions(raw, environment, baseURL);

  const twoFactor = [
    raw.sms && "sms",
    raw.totp && "totp",
    raw.backupCodes && "backup_codes",
  ].filter(Boolean) as TwoFactorMethod[];

  if (twoFactor.length === 0) {
    twoFactor.push("totp");
  }

  if (twoFactor.length !== 1) {
    throw new Error("Only 1 two-factor method is currently supported.");
  }

  const until = raw.until == null ? undefined : String(raw.until);

  return {
    baseURL,
    sp,
    twoFactor: twoFactor[0] ?? "totp",
    until,
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
    const untilArg = options.until
      ? UNTIL_ALIASES[options.until] ?? options.until
      : undefined;

    const signUpState = await SIGN_UP_FLOW.run(
      {},
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

function resolveSpOptions(
  raw: Record<string, string | boolean>,
  environment: string,
  baseURL: URL
): { method: SpMethod; url: URL } | undefined {
  const sp = !!(raw.sp || raw.saml || raw.oidc || raw.spUrl);
  if (!sp) {
    return;
  }

  let method: SpMethod = "oidc";
  let url = raw.spUrl == null ? undefined : new URL(String(raw.spUrl), baseURL);

  if (raw.saml) {
    method = "saml";
  }

  if (!url) {
    const unparsedUrl = (SP_URLS_BY_ENVIRONMENT[environment] ?? {})[method];
    url = unparsedUrl ? new URL(unparsedUrl) : undefined;

    if (!url) {
      throw new Error(
        `Don't know what URL to use for SP ${method} connection in ${environment}. Please specify --sp-url`
      );
    }
  }

  return { method, url };
}
