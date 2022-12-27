import getopts from "getopts";
import { Browser, launch, Page } from "puppeteer";
import * as readline from "node:readline";

import {
  CommandFunctions,
  ProgramOptions,
  ProgramOptionsParser,
} from "./types";
import { screenshot, signUp, verify } from "./commands";

const ALL_COMMANDS = [screenshot, signUp, verify];

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(args: string[]) {
  const parsedOptions = ProgramOptionsParser.parse(getopts(args));
  if (!parsedOptions.success) {
    throw new Error(parsedOptions.errors.map((err) => err.message).join("\n"));
  }

  const options = parsedOptions.parsed;

  if (!options.baseURL) {
    if (options.env) {
      options.baseURL = new URL(
        `https://idp.${options.env}.identitysandbox.gov`
      );
    } else {
      options.baseURL = new URL("http://localhost:3000");
    }
  }

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
      return pagePromise.then((page) => {
        if (page.isClosed()) {
          pagePromise = undefined;
          return funcs.getPage();
        }
        return page;
      });
    },
    getLastSignup: () => undefined,
  };

  const rl = createInterface(funcs, options);
  welcome(options);
  rl.prompt();
}

function createInterface(
  funcs: CommandFunctions,
  options: ProgramOptions
): readline.Interface {
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

    currentPromise = handleCommand(line, rl, funcs, options).finally(() => {
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
  funcs: CommandFunctions,
  options: ProgramOptions
): Promise<void> {
  let promise: Promise<void> | undefined;

  for (let i = 0; i < ALL_COMMANDS.length; i++) {
    promise = ALL_COMMANDS[i].runFromUserInput(line, funcs, options);
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

async function welcome(options: ProgramOptions) {
  console.log(`
Welcome to the Login Assistant!

This is a little helper for you if you're doing work on the Login.gov frontend.

Some commands:

- 'signup' to create a new account
- 'verify' to create a verified account (or verify the one you just created)
- 'screenshot' to take screenshots

We are using <${options.baseURL?.toString()}>

`);
}
