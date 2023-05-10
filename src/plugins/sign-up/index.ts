import chalk from "chalk";
import getopts from "getopts";
import { BrowserHelper } from "../../browser";
import { resolveSpOptions } from "../../sp";
import {
  GlobalState,
  PluginOptions,
  ProgramOptions,
  StateManager,
  TwoFactorMethod,
} from "../../types";
import { SIGN_UP_FLOW } from "./flow";
import { SignupOptions, SignupState } from "./types";
import { EventBus } from "../../events";
import { untilPathIncludes } from "../../dsl";

export { SignupState } from "./types";

export function signUpPlugin({
  browser,
  programOptions,
  events,
  state,
}: PluginOptions) {
  events.on("command:signup", async ({ args }) => {
    const options = parseOptions(args, programOptions);
    await signUp(options, browser, events, state);
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
  browser: BrowserHelper,
  events: EventBus,
  state: StateManager<GlobalState>
): Promise<SignupState | undefined> {
  const frame = (await browser.newPage()).mainFrame();

  const result = await SIGN_UP_FLOW.run({
    hooks: untilPathIncludes(options.until),
    options,
    frame,
    state: {},
  });

  if (!result.completed) {
    return;
  }

  const signup = result.state;

  state.update({
    ...state.current(),
    lastSignup: signup,
  });

  events.emit("signup", {
    signup,
  });
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
