// This file defines a really, really limited parser for internet messages.
// Don't use it for anything.

import { parseContentType } from "./mime/content-type";
import { parseHeadersAndBody } from "./mime/headers";
import { createMultipartParser } from "./mime/multipart";
import { Header, MIMEChunk } from "./mime/types";

export type Message = {
  messageId: string;
  from: string;
  replyTo: string;
  to: string[];
  subject: string;
  body: {
    "text/plain": string;
    "text/html": string;
  };
};

type ParserState = "headers" | "body";

/**
 * Takes a string containing potentially _many_ email messages and parses them
 * out.
 */
export function parseMultipleEmails(data: string): Message[] {
  const result: Message[] = [];
  while (true) {
    const [message, remainder] = parseEmail(data);
    result.push(message);
    if (remainder.trim().length > 0) {
      data = remainder;
    } else {
      return result;
    }
  }
}

/**
 * Parses a string into an Email message and whatever was left in the string
 * after the end of the email message body.
 */
export function parseEmail(data: string): [Message, string] {
  const { headers, body } = parseHeadersAndBody(data);
  const [chunks, remainder] = getBodyMIMEChunks(headers, body);

  const message: Message = {
    messageId: headers.find(({ name }) => name === "message-id")?.value ?? "",
    from: headers.find(({ name }) => name === "from")?.value ?? "",
    replyTo: headers.find(({ name }) => name === "reply-to")?.value ?? "",
    to: [headers.find(({ name }) => name === "to")?.value ?? ""],
    subject: headers.find(({ name }) => name === "subject")?.value ?? "",
    body: {
      "text/plain":
        chunks
          .find((c) => c.contentType.name === "text/plain")
          ?.body?.toString("utf-8") ?? "",
      "text/html":
        chunks
          .find((c) => c.contentType.name === "text/html")
          ?.body?.toString("utf-8") ?? "",
    },
  };

  return [message, remainder];
}

function getBodyMIMEChunks(
  headers: Header[],
  body: string
): [MIMEChunk[], string] {
  const contentType = parseContentType(
    headers.find(({ name }) => name === "content-type")?.value ?? "text/plain"
  );

  let chunks: MIMEChunk[] | undefined;
  let remainder: string | undefined;

  if (
    contentType.name === "multipart/related" ||
    contentType.name === "multipart/alternative"
  ) {
    const { boundary } = contentType.options;
    if (!boundary) {
      throw new Error("multipart without boundary");
    }
    const parser = createMultipartParser(boundary);
    [chunks, remainder] = parser(body);
  } else {
    throw new Error("Not implemented: non-multipart bodies");
  }

  let bodyChunks: MIMEChunk[];

  if (contentType.name === "multipart/related") {
    // We need to pick the chunks that actually represent the body
    // So this might be a text/html, text/plain or multipart/alternative

    const bestChunk = chunks.find((c) =>
      ["text/plain", "text/html", "multipart/alternative"].includes(
        c.contentType.name
      )
    );

    if (!bestChunk) {
      throw new Error("no best chunk to use");
    }

    if (bestChunk.contentType.name === "multipart/alternative") {
      const { boundary } = bestChunk.contentType.options;
      if (!boundary) {
        throw new Error("multipart chunk without a boundary");
      }
      const parser = createMultipartParser(boundary);
      [bodyChunks] = parser(bestChunk.body.toString("utf-8"));
    } else {
      bodyChunks = [bestChunk];
    }
  } else {
    bodyChunks = chunks;
  }

  return [bodyChunks, remainder];
}
