import getopts from "getopts";

import { GlobalState, ProgramOptions, ProgramOptionsParser } from "./types";
import { screenshot, signUp, verify } from "./commands";
import { createInterface } from "./interface";

const ALL_COMMANDS = [screenshot, signUp, verify];

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(args: string[]) {
  const programOptions = getProgramOptions(args);
  const { welcome, prompt } = createInterface(ALL_COMMANDS, programOptions);
  welcome();
  prompt();
}

function getProgramOptions(args: string[]): ProgramOptions {
  const parsedOptions = ProgramOptionsParser.parse(getopts(args));
  if (!parsedOptions.success) {
    throw new Error(parsedOptions.errors.map((err) => err.message).join("\n"));
  }

  const options = parsedOptions.parsed;

  if (!options.baseURL) {
    if (options.env) {
      options.baseURL = new URL(
        `https://idp.${options.env}.identitysandbox.gov`
      );
    } else {
      options.baseURL = new URL("http://localhost:3000");
    }
  }

  return options;
}
