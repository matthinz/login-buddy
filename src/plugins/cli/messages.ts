import chalk from "chalk";
import * as format from "./format";
import { EmailMessage, Message, TelephonyMessage } from "../../types";

export function reportMessage(
  message: Message,
  log: (...args: unknown[]) => void,
  previewUrl?: URL | undefined
) {
  if (message.type === "email") {
    reportEmail(message, log, previewUrl);
  } else {
    reportTelephonyMessage(message, log);
  }
}

function reportEmail(
  message: EmailMessage,
  log: (...args: unknown[]) => void,
  previewURL: URL | undefined
) {
  log(
    chalk.dim("\n💌 New email to %s: %s\n%s%s"),
    message.to.join(","),
    chalk.bold(message.subject),
    getLinksInEmail(message)
      .map((link) => `   ${format.link(link)}`)
      .join("\n"),
    previewURL ? `\n    Preview: ${format.link(previewURL)}` : ""
  );
}

function reportTelephonyMessage(
  message: TelephonyMessage,
  log: (...args: unknown[]) => void
) {
  const emoji = message.type === "sms" ? "💬" : "☎️";

  let { body } = message;

  if (message.type === "voice") {
    // Clean up voice XML a little to make it easier to read
    body = body.replace(/\s*</g, "\n<");
  }

  log(
    chalk.dim("\n%s New %s message to %s: %s"),
    emoji,
    message.type,
    message.to.join(","),
    body
  );
}

function getLinksInEmail(message: EmailMessage): string[] {
  const REGEX = /https?:\/\/[^\s]+/g;
  const urls = new Set<string>();

  while (true) {
    const m = REGEX.exec(message.body);
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

    const isPublicSite = url.host === "www.login.gov";
    if (isPublicSite) {
      continue;
    }

    const isDeep = /\/.*?\//.test(url.pathname);
    const hasQueryString = url.search.length > 1;
    if (isDeep || hasQueryString || isPublicSite) {
      urls.add(url.toString());
    }
  }

  return Array.from(urls);
}
