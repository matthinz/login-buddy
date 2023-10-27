import chalk from "chalk";
import * as readline from "node:readline";

import {
  CommandEvent,
  Message,
  PluginOptions,
  ProgramOptions,
} from "../../types";
import { reportMessage } from "./messages";

export function cliPlugin({ programOptions, events, state }: PluginOptions) {
  let currentExecution: Promise<void> | undefined;

  let lastMessage: Message | undefined;
  let lastMessageTimer: NodeJS.Timeout | undefined;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentExecution) {
      log("Hold on");
      return;
    }

    const args = parseLine(line);
    const command = args.shift();
    const event: CommandEvent = {
      args,
      programOptions,
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

  events.on("message", ({ message }) => {
    if (lastMessage) {
      clearTimeout(lastMessageTimer);
      lastMessageTimer = undefined;

      reportMessage(lastMessage, log);
      lastMessage = undefined;
    }

    lastMessage = message;
    lastMessageTimer = setTimeout(() => {
      lastMessageTimer = undefined;
      if (lastMessage) {
        reportMessage(lastMessage, log);
        lastMessage = undefined;
      }
    }, 1000);
  });

  events.on("messagePreviewAvailable", ({ message, url }) => {
    if (message === lastMessage) {
      reportMessage(message, log, url);
      clearTimeout(lastMessageTimer);
      lastMessage = undefined;
    }
  });

  events.on("error", ({ error }) => {
    err(error);
  });

  events.on("idpConnectionLost", () => {
    err("\n🙀 Error polling for SMS/voice messages--is the IdP running?");
  });

  events.on("idpConnectionRestored", () => {
    err("\n🐈 connection to the IdP restored.");
  });

  welcome(programOptions);

  // Aesthetic thing: clear the fetch() api warning
  setTimeout(() => {
    rl.prompt();
  }, 500);

  function err(...args: unknown[]) {
    console.error.apply(console, args);
    rl.prompt();
  }

  function log(...args: unknown[]) {
    console.log.apply(console, args);
    rl.prompt();
  }
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
