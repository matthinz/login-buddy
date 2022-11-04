import { Browser, launch, Page } from "puppeteer";
import { runFlow } from "./flows";
import { SCREENSHOT_FLOW } from "./flows/screenshot";
import { SIGN_UP_FLOW } from "./flows/sign-up";
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
    await signUp();
  }

  if (/^(screenshots?|shoot)$/i.test(line)) {
    await takeScreenshots();
  }

  if (line === "verify") {
    await startVerification();
  }
}

async function signUp() {
  if (user) {
    throw new Error("TODO: sign out");
  }

  const browser = await launchBrowser();

  if (tab) {
    await tab.close();
  }

  tab = await browser.newPage();

  const { email, password, backupCodes } = await runFlow(SIGN_UP_FLOW, { tab });

  user = {
    email: String(email),
    password: String(password),
    backupCodes: Array.isArray(backupCodes) ? (backupCodes as string[]) : [],
  };

  console.log("Your user is %s, password %s", user.email, user.password);
  console.log("Backup codes:");
  user.backupCodes.forEach((code) => console.log(code));
}

async function takeScreenshots() {
  if (!tab || !user) {
    console.error("No session running");
    return;
  }

  await runFlow(SCREENSHOT_FLOW, { tab });
}

async function startVerification() {
  if (!user) {
    await signUp();
  }

  if (!tab) {
    throw new Error();
  }

  console.log("starting verification...");

  await runFlow(VERIFY_FLOW, { tab });
}
