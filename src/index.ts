import * as dotenv from "dotenv";
import { GlobalState, ProgramOptions } from "./types";
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
import { EventBus } from "./events";

const ALL_COMMANDS: Command<GlobalState, {}>[] = [
  backupCode,
  login,
  screenshot,
  signOut,
  signUp,
  verify,
];

const PLUGINS: ((
  programOptions: ProgramOptions,
  eventBus: EventBus
) => void)[] = [emailsPlugin];

dotenv.config();

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(argv: string[]) {
  const programOptions = await resolveOptions(argv);

  const eventBus = new EventBus();

  PLUGINS.forEach((plugin) => plugin(programOptions, eventBus));

  const { welcome, prompt } = createInterface(ALL_COMMANDS, programOptions);

  welcome();
  prompt();
}
