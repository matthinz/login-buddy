import fs from "node:fs/promises";
import path from "node:path";
import chokidar from "chokidar";
import { Message, parseMultipleEmails } from "./parser";
import { ProgramOptions } from "../../types";
import chalk from "chalk";
import { EventBus } from "../../events";

export function emailsPlugin(options: ProgramOptions, events: EventBus) {
  const { idpRoot } = options;

  if (idpRoot == null) {
    return;
  }

  const emailsDirectory = path.join(idpRoot, "tmp", "mails");

  const filesToReview = new Set<string>();
  const emailCountsByFile = new Map<string, number>();

  let timer: NodeJS.Timeout | undefined;
  let initializing = true;
  let initializationPromise = Promise.resolve();
  let reviewInProgress = false;

  chokidar
    .watch(emailsDirectory)
    .on("add", (path, stats) => {
      if (initializing) {
        recordNumberOfEmailsInFile(path);
      } else {
        scheduleReview(path);
      }
    })
    .on("change", (path, stats) => {
      if (initializing) {
        recordNumberOfEmailsInFile(path);
      } else {
        scheduleReview(path);
      }
    })
    .on("unlink", (path) => {
      if (initializing) {
        recordNumberOfEmailsInFile(path);
      } else {
        emailCountsByFile.set(path, 0);
      }
    })
    .on("ready", () => {
      initializationPromise = initializationPromise.then(() => {
        initializing = false;
      });
    });

  function recordNumberOfEmailsInFile(file: string) {
    initializationPromise = initializationPromise.then(async () => {
      let messages: Message[];

      try {
        messages = await parseEmailFile(file);
      } catch (err: any) {
        if (err.code !== "ENOTFOUND") {
          throw err;
        }
        messages = [];
      }

      emailCountsByFile.set(file, messages.length);
    });
  }

  function reportNewEmail(message: Message) {
    console.log(
      chalk.dim("\n💌 New email to %s: %s\n%s\n"),
      message.to.join(","),
      chalk.bold(message.subject),
      getLinksInEmail(message)
        .map((link) => chalk.blueBright(`   ${link}`))
        .join("\n")
    );
  }

  function reviewUpdatedFiles() {
    if (reviewInProgress) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(reviewUpdatedFiles, 500);
      return;
    }

    const files = Array.from(filesToReview);
    filesToReview.clear();

    reviewInProgress = true;

    Promise.all(
      files.map(async (file) => {
        const messages = await parseEmailFile(file);
        const prevCount = emailCountsByFile.get(file) ?? 0;

        const newMessages = messages.slice(prevCount);
        emailCountsByFile.set(file, messages.length);
        newMessages.forEach(reportNewEmail);
      })
    ).finally(() => {
      reviewInProgress = false;
    });
  }

  function scheduleReview(file: string) {
    if (timer) {
      clearTimeout(timer);
    }
    filesToReview.add(file);
    timer = setTimeout(reviewUpdatedFiles, 500);
  }
}

async function parseEmailFile(file: string): Promise<Message[]> {
  const data = await fs.readFile(file);
  return parseMultipleEmails(data.toString("utf-8"));
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
