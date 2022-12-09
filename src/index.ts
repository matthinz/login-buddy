import { Browser, launch, Page, Puppeteer } from "puppeteer";
import { runFlow } from "./flows";
import { SCREENSHOT_FLOW } from "./flows/screenshot";
import { SIGN_UP_FLOW } from "./flows/sign-up";
import { SP_SIGN_UP_FLOW } from "./flows/sp-sign-up";
import { VERIFY_FLOW } from "./flows/verify";

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
  listenForCommands(process.stdin);
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

function listenForCommands(stream: NodeJS.ReadStream): () => Promise<void> {
  let buffer: Buffer | undefined;

  let promise: Promise<void> = Promise.resolve();

  stream.on("data", handleData);

  stream.on("close", handleClose);

  function handleClose() {
    handleData(undefined);
  }

  function handleData(chunk: Buffer | undefined) {
    if (chunk != null) {
      buffer = buffer == null ? chunk : Buffer.concat([buffer, chunk]);
    }
    if (buffer == null) {
      return;
    }
    const lines = buffer.toString("utf8").split("\n");
    buffer = Buffer.from(lines.pop() ?? "");

    lines.forEach((line) => {
      promise = promise.then(() => handleCommand(line));
    });
  }

  return () => {
    stream.off("close", handleClose);
    stream.off("data", handleData);
    return promise;
  };
}

async function handleCommand(line: string): Promise<void> {
  if (line === "new user" || line === "signup") {
    await signUp(!!process.env["SP_SIGNUP"]);
  }

  let m = /^(screen\s*shots?|shoot)(.*)/i.exec(line);

  if (m) {
    await takeScreenshots(m[2].trim());
  }

  if (line === "verify") {
    await startVerification();
  }
}

async function signUp(fromSp?: boolean): Promise<Record<string, unknown>> {
  if (user) {
    throw new Error("TODO: sign out");
  }

  const browser = await launchBrowser();

  if (tab) {
    await tab.close();
  }

  tab = await browser.newPage();

  if (process.env["MOBILE"]) {
    await tab.setUserAgent("iphone");
  }

  const state = await runFlow(fromSp ? SP_SIGN_UP_FLOW : SIGN_UP_FLOW, { tab });

  user = {
    email: String(state.email),
    password: String(state.password),
    backupCodes: Array.isArray(state.backupCodes)
      ? (state.backupCodes as string[])
      : [],
  };

  console.log("Your user is %s, password %s", user.email, user.password);
  console.log("Backup codes:");
  user.backupCodes.forEach((code) => console.log(code));

  return state;
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
    await signUp();
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
