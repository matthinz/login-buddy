import chalk from "chalk";
import * as readline from "node:readline";
import { Browser, launch } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { EventBus } from "../../events";

import {
  CommandEvent,
  GlobalState,
  PluginOptions,
  ProgramOptions,
  StateManager,
} from "../../types";
import { reportMessage } from "./messages";

export function cliPlugin({ programOptions, events, state }: PluginOptions) {
  let currentExecution: Promise<void> | undefined;
  const browser = new BrowserHelper(
    createBrowserLauncher(events, state, programOptions)
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentExecution) {
      console.log("Hold on");
      return;
    }

    const args = parseLine(line);
    const command = args.shift();
    const event: CommandEvent = {
      args,
      browser,
      state,
    };

    currentExecution = events.emit(`command:${command}`, event).finally(() => {
      currentExecution = undefined;
      rl.prompt();
    });
  });

  rl.on("close", () => {
    process.exit();
  });

  events.on("ask", ({ prompt, received, respond }) => {
    received();
    rl.question(prompt, respond);
  });

  events.on("message", ({ message }) => reportMessage(message));

  events.on("error", ({ error }) => {
    console.error(error);
  });

  welcome(programOptions);

  // Aesthetic thing: clear the fetch() api warning
  setTimeout(() => {
    rl.prompt();
  }, 500);
}

function createBrowserLauncher(
  events: EventBus,
  state: StateManager<GlobalState>,
  programOptions: ProgramOptions
): () => Promise<Browser> {
  const { browser } = state.current();
  if (browser) {
    return () => Promise.resolve(browser);
  }

  const LAUNCH_OPTIONS = {
    args: [
      programOptions.ignoreSslErrors && "--ignore-certificate-errors",
      programOptions.ignoreSslErrors &&
        `--unsafely-treat-insecure-origin-as-secure="${programOptions.baseURL.toString()}"`,
    ].filter(Boolean) as string[],
    headless: false,
    defaultViewport: null,
  };

  return () =>
    launch(LAUNCH_OPTIONS).then(async (browser) => {
      state.update({
        ...state.current(),
        browser,
      });
      await events.emit("newBrowser", { browser });
      return browser;
    });
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let quoteChar: "'" | '"' | undefined;
  let escapeNext = false;
  let current = "";

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (escapeNext) {
      current += c;
      escapeNext = false;
      continue;
    }

    if (c === quoteChar) {
      result.push(current);
      current = "";
      continue;
    }

    if (c === "'" || c === '"') {
      if (current.length > 0) {
        result.push(current);
        current = "";
      }
      quoteChar = c;
      continue;
    }

    if (/\s/.test(c)) {
      if (current.length > 0) {
        result.push(current);
        current = "";
      }
      continue;
    }

    current += c;
  }

  if (current.length > 0) {
    result.push(current);
  }
  return result;
}

function welcome({ baseURL }: ProgramOptions) {
  console.log(`
${chalk.bold("Welcome to Login Buddy!")}

This is a little helper for you if you're doing work on the 
Login.gov frontend.

Some commands:

- ${chalk.bold("signup")} to create a new account
- ${chalk.bold("verify")} to verify the account you just created
- ${chalk.bold("screenshot")} to take screenshots

We are using ${chalk.blue(`<${baseURL?.toString()}>`)} 
(You can change this with the --env option.)

`);
}

function makeAsker(
  rl: readline.Interface
): (prompt: string) => Promise<string | undefined> {
  return (prompt: string) => {
    return new Promise<string | undefined>((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };
}
