import chalk from "chalk";
import { sign } from "crypto";
import getopts from "getopts";
import { launch } from "puppeteer";
import { EventBus } from "../../events";
import { resolveSpOptions } from "../../sp";
import {
  GlobalState,
  PluginOptions,
  ProgramOptions,
  TwoFactorMethod,
} from "../../types";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions } from "./types";

export { SignupState } from "./types";

const DEFAULT_BASE_EMAIL_ADDRESS = "test@example.org";

// I can never remember what urls are what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

export function signUpPlugin({ programOptions, events }: PluginOptions) {
  events.on("command:signup", async (event) => {
    const options = parseOptions(event.args, programOptions);
    const newState = await signUp(options, event.state.current());
    event.state.update(newState);

    const signup = newState.lastSignup;
    if (signup) {
      events.emit("signup", {
        signup,
      });
    }
  });

  events.on("signup", ({ signup: { email, password, phone, backupCodes } }) => {
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
  });
}

async function signUp(
  options: SignupOptions,
  globalState: GlobalState
): Promise<GlobalState> {
  const browser =
    globalState.browser ??
    (await launch({
      headless: false,
      defaultViewport: null,
    }));

  const page = await browser.newPage();

  const lastSignup = await SIGN_UP_FLOW.run({}, { ...options, page });

  return {
    ...globalState,
    browser,
    lastSignup,
  };
}

export function parseOptions(
  args: string[],
  { baseURL, environment }: ProgramOptions
): SignupOptions {
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
  }
  const baseEmailAddress =
    raw.email == null ? DEFAULT_BASE_EMAIL_ADDRESS : String(raw.email);

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
    baseEmailAddress,
    baseURL,
    sp,
    twoFactor: twoFactor[0] ?? "totp",
    until,
  };
}
