import { Browser, launch, Page, Puppeteer } from "puppeteer";
import { runFlow } from "./flows";
import { SCREENSHOT_FLOW } from "./flows/screenshot";
import { SIGN_UP_FLOW } from "./flows/sign-up";
import { SP_SIGN_UP_FLOW } from "./flows/sp-sign-up";
import { VERIFY_FLOW } from "./flows/verify";

import readline from "node:readline";

type LoginUser = {
  email: string;
  password: string;
  backupCodes: string[];
};

let browserPromise: Promise<Browser> | undefined;
let tab: Page | undefined;
let user: LoginUser | undefined;

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run() {
  let currentPromise: Promise<void> | undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentPromise) {
      console.error("Hold on, busy now");
      return;
    }

    currentPromise = handleCommand(line, rl).finally(() => {
      currentPromise = undefined;
      rl.prompt();
    });
  });

  rl.on("close", () => {
    process.exit();
  });

  rl.prompt();
}

function launchBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch({
      headless: false,
      defaultViewport: null,
    });
  }
  return browserPromise;
}

async function handleCommand(
  line: string,
  rl: readline.Interface
): Promise<void> {
  if (line === "new user" || line === "signup") {
    await signUp(!!process.env["SP_SIGNUP"], rl);
    return;
  }

  let m = /^(screen\s*shots?|shoot)(.*)/i.exec(line);

  if (m) {
    await takeScreenshots(m[2].trim());
    return;
  }

  if (line === "verify") {
    await startVerification();
    return;
  }
}

async function signUp(
  fromSp: boolean,
  rl: readline.Interface
): Promise<Record<string, unknown>> {
  if (user) {
    throw new Error("TODO: sign out");
  }

  const browser = await launchBrowser();

  try {
    await SIGN_UP_FLOW.run({
      baseURL: "http://localhost:3000",
      browser,
    });
  } catch (err) {
    console.error(err);
    console.error("HI");
    rl.question("", () => {
      browser.close().then(() => {
        process.exit();
      });
    });
  }

  // const state = await runFlow(fromSp ? SP_SIGN_UP_FLOW : SIGN_UP_FLOW, { tab });

  // user = {
  //   email: String(state.email),
  //   password: String(state.password),
  //   backupCodes: Array.isArray(state.backupCodes)
  //     ? (state.backupCodes as string[])
  //     : [],
  // };

  // console.log("Your user is %s, password %s", user.email, user.password);
  // console.log("Backup codes:");
  // user.backupCodes.forEach((code) => console.log(code));

  // return state;
  return {};
}

async function takeScreenshots(tag: string) {
  if (!tab || !user) {
    console.error("No session running");
    return;
  }

  const state = {
    tag,
  };

  await runFlow(SCREENSHOT_FLOW, { state, tab });
}

async function startVerification() {
  if (!user) {
    throw new Error("not implemented");
    // await signUp();
  }

  if (!tab) {
    throw new Error();
  }

  console.log("starting verification...");

  const state = {
    ...user,
  };

  const { personalKey } = await runFlow(VERIFY_FLOW, { tab, state });

  console.log("Your personal key is %s", personalKey);
}
