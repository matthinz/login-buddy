import chalk from "chalk";
import getopts from "getopts";
import { Page } from "puppeteer";
import { until } from "../../dsl";
import { resolveSpOptions } from "../../sp";
import { GlobalState, TwoFactorMethod } from "../../types";
import { CommandHooks } from "../types";
import { runFromPageFancy } from "../utils";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions } from "./types";

export { SignupState } from "./types";

const DEFAULT_BASE_PHONE_NUMBER = "3602345678";

// I can never remember what urls are what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

export function parseOptions(
  args: string[],
  {
    programOptions: { baseURL, baseEmail, basePhone, environment },
  }: GlobalState
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

  if (raw.email != null) {
    if (typeof raw.email !== "string") {
      throw new Error("Invalid --email");
    }
    baseEmail = raw.email;
  }

  if (raw.phone != null) {
    basePhone = String(raw.phone);
  }

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
    baseEmail,
    basePhone,
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

    const { email, password, totpCode, backupCodes, phone } = signUpState;

    if (!email || !password) {
      return globalState;
    }

    const info = [
      ["Email", email],
      ["Password", password],
      phone && ["Phone", phone],
      backupCodes && ["Backup codes", backupCodes.join("\n")],
    ].filter(Boolean) as [string, string][];

    console.log(
      [
        chalk.bold("Signup complete!"),
        ...info.map(([label, value]) => {
          if (/\n/.test(value)) {
            return `${chalk.dim(label)}:\n${value
              .split("\n")
              .map((line) => `  ${line}`)
              .join("\n")}`;
          } else {
            return `${chalk.dim(label)}: ${value}`;
          }
        }),
      ].join("\n")
    );

    return {
      ...globalState,
      lastSignup: {
        email,
        password,
        totpCode,
        phone,
        backupCodes,
      },
    };
  }
);
