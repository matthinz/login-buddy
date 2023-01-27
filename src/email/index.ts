import fs from "node:fs/promises";
import path, { parse } from "node:path";
import chokidar from "chokidar";
import { Message, parseEmail, parseMultipleEmails } from "./parser";

type Options = {
  idpDirectory?: string;
  emailsDirectory?: string;
  onNewEmail?: (message: Message) => void;
};

export function watchForEmails({
  idpDirectory,
  emailsDirectory,
  onNewEmail,
}: Options = {}) {
  idpDirectory = idpDirectory ?? process.env.IDP_ROOT;

  if (!emailsDirectory) {
    if (!idpDirectory) {
      throw new Error("IDP not found. Set IDP_ROOT");
    }

    emailsDirectory = path.join(idpDirectory ?? ".", "tmp", "mails");
  }

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
        newMessages.forEach((message) => {
          if (onNewEmail) {
            setImmediate(onNewEmail, message);
          }
        });
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
