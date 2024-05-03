// This file defines a really, really limited parser for internet messages.
// Don't use it for anything.

import { parseContentType } from "./mime/content-type";
import { parseHeadersAndBody } from "./mime/headers";
import { createMultipartParser } from "./mime/multipart";
import { ContentType, Header, MIMEChunk } from "./mime/types";

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

  if (!isMultipartContentType(contentType)) {
    throw new Error("Not implemented: non-multipart bodies");
  }

  [chunks, remainder] = parseMultipartBody(body, contentType);

  // Not all chunks actually represent the body of the email.
  // We are looking for text or HTML.

  const bodyChunks = chunks.filter((c) =>
    ["text/plain", "text/html"].includes(c.contentType.name)
  );

  if (bodyChunks.length === 0) {
    throw new Error("No body chunks");
  }

  return [bodyChunks, remainder];
}

function isMultipartContentType(contentType: ContentType): boolean {
  return /^multipart\//.test(contentType.name);
}

function parseMultipartBody(
  body: string | Buffer,
  contentType: ContentType
): [MIMEChunk[], string] {
  const { boundary } = contentType.options;
  if (!boundary) {
    throw new Error("multipart without boundary");
  }
  const parser = createMultipartParser(boundary);
  const [chunks, remainder] = parser(body.toString("utf-8"));

  const expandedChunks = chunks.reduce<MIMEChunk[]>((result, chunk) => {
    if (!isMultipartContentType(chunk.contentType)) {
      result.push(chunk);
      return result;
    }

    const [subchunks] = parseMultipartBody(chunk.body, chunk.contentType);
    result.push(...subchunks);

    return result;
  }, []);

  return [expandedChunks, remainder];
}
