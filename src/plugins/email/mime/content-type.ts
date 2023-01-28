import { ContentType } from "./types";

export function parseContentType(input: string): ContentType {
  const pos = input.indexOf(";");
  if (pos < 0) {
    return {
      name: input,
      options: {},
    };
  }

  const name = input.substring(0, pos);
  const options = input
    .substring(pos + 1)
    .split(";")
    .reduce<Record<string, string>>((result, text) => {
      const pos = text.indexOf("=");
      if (pos < 0) {
        result[text] = "";
        return result;
      }
      const key = text.substring(0, pos).replace(/^[ \t]+/, "");
      const value = text
        .substring(pos + 1)
        .replace(/^[ \t]+/, "")
        .replace(/(^"|"$)/g, "");
      result[key] = value;
      return result;
    }, {});

  return { name, options };
}
