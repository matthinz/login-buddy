import fs from "node:fs/promises";
import path from "node:path";
import chokidar from "chokidar";
import { Message, parseMultipleEmails } from "./parser";
import { MessageEvent, PluginOptions } from "../../types";

export function emailPlugin({ events, programOptions }: PluginOptions) {
  const { idpRoot } = programOptions;

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

        newMessages
          .map<MessageEvent>((email) => ({
            message: {
              type: "email",
              time: new Date(),
              to: email.to,
              subject: email.subject,
              body: email.body["text/plain"],
              htmlBody: email.body["text/html"],
            },
          }))
          .forEach((event) => events.emit("message", event));
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
