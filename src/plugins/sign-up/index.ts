import chalk from "chalk";
import getopts from "getopts";
import { BrowserHelper } from "../../browser";
import { resolveSpOptions } from "../../sp";
import { PluginOptions, ProgramOptions, TwoFactorMethod } from "../../types";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, SignupState } from "./types";

export { SignupState } from "./types";

// I can never remember what urls are what.
const UNTIL_ALIASES: { [key: string]: string | undefined } = {
  mfa: "/authentication_methods_setup",
};

export function signUpPlugin({ programOptions, events, state }: PluginOptions) {
  events.on("command:signup", async ({ args, browser }) => {
    const options = parseOptions(args, programOptions);
    const signup = await signUp(browser, options);

    if (signup) {
      state.update({
        ...state.current(),
        lastSignup: signup,
      });

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
  browser: BrowserHelper,
  options: SignupOptions
): Promise<SignupState> {
  const page = await browser.newPage();
  return await SIGN_UP_FLOW.run({}, { ...options, page });
}

export function parseOptions(
  args: string[],
  { baseURL, baseEmail, basePhone, environment }: ProgramOptions
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

  baseEmail = raw.email == null ? baseEmail : String(raw.email);

  basePhone = raw.phone == null ? basePhone : String(raw.phone);

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