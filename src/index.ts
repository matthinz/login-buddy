import * as dotenv from "dotenv";
import getopts from "getopts";

import { GlobalState, ProgramOptions, ProgramOptionsParser } from "./types";
import {
  backupCode,
  Command,
  login,
  screenshot,
  signOut,
  signUp,
  verify,
} from "./commands";
import { createInterface } from "./interface";
import { watchForEmails } from "./email";
import { Message } from "./email/parser";

const ALL_COMMANDS: Command<unknown, GlobalState>[] = [
  backupCode,
  login,
  screenshot,
  signOut,
  signUp,
  verify,
];

dotenv.config();

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(args: string[]) {
  const programOptions = getProgramOptions(args);
  const { welcome, prompt } = createInterface(ALL_COMMANDS, programOptions);

  watchForEmails({
    onNewEmail(message) {
      console.log(
        "\n> New email to %s: %s",
        message.to.join(","),
        message.subject
      );
      getLinksInEmail(message).forEach((link) => {
        console.log("> %s", link);
      });
      prompt();
    },
  });

  welcome();
  prompt();
}

function getProgramOptions(args: string[]): ProgramOptions {
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

  return options;
}

function getLinksInEmail(message: Message): string[] {
  const REGEX = /https?:\/\/[^\s]+/g;
  const urls = new Set<string>();

  while (true) {
    const m = REGEX.exec(message.body["text/plain"]);
    if (!m) {
      break;
    }

    let url: URL;
    try {
      url = new URL(m[0]);
    } catch (err) {
      console.error(err);
      continue;
    }

    // Some simple heuristics to ignore boring URLs
    const isDeep = /\/.*?\//.test(url.pathname);
    const hasQueryString = url.search.length > 1;
    if (isDeep || hasQueryString) {
      urls.add(url.toString());
    }
  }

  return Array.from(urls);
}
