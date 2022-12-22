import { CommandFunctions } from "../../types";
import { SIGN_UP_FLOW } from "./flow";

export type Options = {};

const REGEX = /^sign\s*up\b(.*)/i;

export function parse(line: string): Options | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  return {};
}

export async function run(
  options: Options,
  { getPage }: CommandFunctions
): Promise<void> {
  const page = await getPage();
  await SIGN_UP_FLOW.run({
    baseURL: "http://localhost:3000",
    page,
  });
}

export function runFromUserInput(
  line: string,
  funcs: CommandFunctions
): Promise<void> | undefined {
  const options = parse(line);
  return options ? run(options, funcs) : undefined;
}
