import { CommandFunctions } from "../../types";
import { VERIFY_FLOW } from "./flow";

export type Options = {};

const REGEX = /^verify\b(.*)/i;

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
  await VERIFY_FLOW.run({
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
