import quotedPrintable from "quoted-printable";
import utf8 from "utf8";

export function createDecoder(
  transferEncoding: string
): (input: string) => string | Buffer {
  switch (transferEncoding) {
    case "7bit":
    case "8bit":
    case "binary":
      return (input) => input;

    case "quoted-printable":
      return (input) => utf8.decode(quotedPrintable.decode(input));

    case "base64":
      return (input) => Buffer.from(input, "base64");

    default:
      throw new Error(`Unsupported transfer encoding: ${transferEncoding}`);
  }
}
