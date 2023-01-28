import { join } from "path";
import { parseContentType } from "./content-type";
import { createDecoder } from "./decode";
import { parseHeadersAndBody } from "./headers";
import { Header, MIMEChunk } from "./types";

/**
 * Creates a function that parses multipart content, returning
 * a tuple containing the related chunks as well as any training remainder
 * after parsing completes.
 */
export function createMultipartParser(
  boundary: string
): (data: string) => [MIMEChunk[], string] {
  const START = `--${boundary}`;
  const END = `--${boundary}--`;

  return function parseMultipart(data: string) {
    type WIP = {
      reachedTheEnd?: boolean;
      chunks: MIMEChunk[];
      currentChunk?: string[] | undefined;
      remainder: string[];
    };

    const { chunks, remainder } = data.split("\r\n").reduce<WIP>(
      ({ chunks, currentChunk, reachedTheEnd, remainder }, line) => {
        if (reachedTheEnd) {
          // We've already hit the end of this, so everything
          // that follows is "remainder"
          remainder.push(line);
          return {
            chunks,
            reachedTheEnd,
            remainder,
          };
        }

        if (line === START) {
          // we're starting a new chunk
          if (currentChunk) {
            chunks.push(parseChunk(currentChunk));
          }
          return {
            chunks,
            currentChunk: [],
            remainder: [],
          };
        }

        if (line === END) {
          // We are done processing. Everything else is remainder
          if (currentChunk) {
            chunks.push(parseChunk(currentChunk));
          }

          return {
            reachedTheEnd: true,
            chunks,
            remainder,
          };
        }

        if (currentChunk) {
          currentChunk.push(line);
          return {
            chunks,
            currentChunk,
            remainder: [],
          };
        }

        // We're not in a chunk. This indicates that everything
        // goes into the remainder
        remainder.push(line);
        return { chunks, remainder };
      },
      {
        chunks: [],
        remainder: [],
      }
    );

    return [chunks, remainder.join("\r\n")];
  };
}

function parseChunk(lines: string[]): MIMEChunk {
  let { headers, body } = parseHeadersAndBody(lines);

  const contentTypeHeader = headers.find(({ name }) => name === "content-type");

  if (!contentTypeHeader) {
    throw new Error("No Content-Type header found");
  }

  const contentType = parseContentType(contentTypeHeader.value);
  headers = headers.filter((h) => h !== contentTypeHeader);

  let bodyAsStringOrBuffer: string | Buffer = body;

  // Handle transfer encoding
  const transferEncodingHeader = headers.find(
    ({ name }) => name === "content-transfer-encoding"
  );
  if (transferEncodingHeader) {
    headers = headers.filter((h) => h !== transferEncodingHeader);
    const decoder = createDecoder(transferEncodingHeader.value);
    bodyAsStringOrBuffer = decoder(bodyAsStringOrBuffer);
  }

  return {
    headers,
    contentType,
    body: bodyAsStringOrBuffer,
  };
}
