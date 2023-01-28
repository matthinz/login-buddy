import * as dotenv from "dotenv";
import { GlobalState } from "./types";
import {
  backupCode,
  Command,
  login,
  screenshot,
  signOut,
  signUp,
  verify,
} from "./commands";
import { createInterface } from "./interface";
import { emailsPlugin } from "./plugins/email";
import { resolveOptions } from "./options";

const ALL_COMMANDS: Command<unknown, GlobalState>[] = [
  backupCode,
  login,
  screenshot,
  signOut,
  signUp,
  verify,
];

dotenv.config();

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(argv: string[]) {
  const programOptions = await resolveOptions(argv);
  const { welcome, prompt } = createInterface(ALL_COMMANDS, programOptions);

  if (programOptions.watchForEmails) {
    emailsPlugin(programOptions);
  }

  welcome();
  prompt();
}
