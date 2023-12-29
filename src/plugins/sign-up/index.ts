import chalk from "chalk";
import getopts from "getopts";
import { Frame } from "puppeteer";
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
import { PuppeteerPageImpl } from "../../dsl/v3/page";

import * as NUGGETS from "./nuggets";
import { DippedNugget, dipNuggets } from "../../dsl/v3";

export { SignupState } from "./types";

export function signUpPlugin({ browser, events }: PluginOptions) {
  console.error(NUGGETS);
  console.error(Object.values(NUGGETS));

  events.on("command:signup", async ({ args, frameId, programOptions }) => {
    const options = parseOptions(args, programOptions);
    const frame =
      (await browser.getFrameById(frameId)) ??
      (await browser.tryToReusePage(options.baseURL)).mainFrame();

    const page = new PuppeteerPageImpl(frame);

    const initialState = {
      email: generateEmail(options),
    };

    let next: DippedNugget<unknown> | undefined = {
      name: "initial",
      apply: () => Promise.resolve(initialState),
    };

    while (true) {
      if (!next) {
        break;
      }

      console.error("Apply %s", next.name);

      const state: unknown = await next.apply();
      console.error("--> new state:", state);
      const context = { state, page };
      const dipped = await dipNuggets(Object.values(NUGGETS), context);

      switch (dipped.length) {
        case 0:
          next = undefined;
          break;

        case 1:
          next = dipped[0];
          break;

        default:
          throw new Error(
            `Multiple nuggets can apply: ${dipped
              .map((d) => d.name)
              .join(", ")}`
          );
      }
    }

    // await signUp(options, frame, events, state);

    // if (options.alsoVerify) {
    //   await events.emit("command:verify", {
    //     args: [],
    //     frameId,
    //     programOptions,
    //     state,
    //   });
    // }
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
  frame: Frame,
  events: EventBus,
  state: StateManager<GlobalState>
): Promise<SignupState | undefined> {
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
    loggedIn: true,
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
      spUrl: ["sp-url"],
      totp: ["use-totp"],
    },
    boolean: ["sms", "totp", "verify"],
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

  const alsoVerify = !!raw.verify;

  return {
    alsoVerify,
    baseEmail,
    basePhone,
    baseURL,
    sp,
    twoFactor: twoFactor[0] ?? "totp",
    until,
  };
}

function generateEmail(options: SignupOptions): string {
  const [name, ...rest] = options.baseEmail.split("@");
  const now = new Date();

  return [
    name,
    "+",
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "-",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
    "@",
    rest.join("@"),
  ].join("");
}
