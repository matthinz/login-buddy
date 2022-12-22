import { Browser, launch, Page } from "puppeteer";
import readline from "node:readline";

import { CommandFunctions } from "./types";
import { screenshot, signUp, verify } from "./commands";

const ALL_COMMANDS = [screenshot, signUp, verify];

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run() {
  let browserPromise: Promise<Browser> | undefined;
  let pagePromise: Promise<Page> | undefined;

  const funcs: CommandFunctions = {
    getBrowser: () => {
      if (!browserPromise) {
        browserPromise = launch({
          headless: false,
          defaultViewport: null,
        });
      }
      return browserPromise;
    },
    getPage: () => {
      if (!pagePromise) {
        pagePromise = funcs.getBrowser().then((browser) => browser.newPage());
      }
      return pagePromise;
    },
    getLastSignup: () => undefined,
  };

  const rl = createInterface(funcs);
  welcome();
  rl.prompt();
}

function createInterface(funcs: CommandFunctions): readline.Interface {
  let currentPromise: Promise<void> | undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentPromise) {
      console.error("Hold your 🐴🐴 please.");
      return;
    }

    currentPromise = handleCommand(line, rl, funcs).finally(() => {
      currentPromise = undefined;
      rl.prompt();
    });
  });

  rl.on("close", () => {
    process.exit();
  });

  return rl;
}

async function handleCommand(
  line: string,
  rl: readline.Interface,
  funcs: CommandFunctions
): Promise<void> {
  let promise: Promise<void> | undefined;

  for (let i = 0; i < ALL_COMMANDS.length; i++) {
    promise = ALL_COMMANDS[i].runFromUserInput(line, funcs);
    if (promise) {
      break;
    }
  }

  if (!promise) {
    console.log("Huh?");
    rl.prompt();
    return;
  }

  await promise;
}

async function welcome() {
  console.log(`
Welcome to the Login Assistant!

This is a little helper for you if you're doing work on the Login.gov frontend.

Some commands:

- 'signup' to create a new account

`);
}
