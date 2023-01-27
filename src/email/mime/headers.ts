import { Header } from "./types";

export function parseHeadersAndBody(input: string | string[]): {
  headers: Header[];
  body: string;
} {
  const lines = Array.isArray(input) ? input : input.split("\r\n");
  let inHeaders = true;
  let currentHeaderLine: string | undefined;

  const headers: Header[] = [];
  const body: string[] = [];

  lines.forEach((line) => {
    if (!inHeaders) {
      body.push(line);
      return;
    }

    if (line.length === 0) {
      if (headers.length === 0 && currentHeaderLine == null) {
        // ignore empty lines at the beginning
        return;
      }

      // An empty line signals the end of the headers.
      consumeHeader();
      inHeaders = false;
      return;
    }

    // Handle folding
    if (/^[ \t]/.test(line)) {
      // This line gets folded up into the previous
      currentHeaderLine =
        (currentHeaderLine ?? "") + line.replace(/^[ \t]+/, "");
    } else {
      consumeHeader();
      currentHeaderLine = line;
    }
    return;
  });

  function consumeHeader() {
    if (currentHeaderLine == null) {
      return;
    }
    const pos = currentHeaderLine.indexOf(":");
    if (pos < 0) {
      return;
    }

    const name = currentHeaderLine.substring(0, pos).toLowerCase();
    const value = currentHeaderLine
      .substring(pos + 1)
      .replace(/^[ \t]+/, "")
      .replace(/(^"|"$)/g, "");

    headers.push({ name, value });
    currentHeaderLine = undefined;
  }

  return {
    headers,
    body: body.join("\r\n"),
  };
}
