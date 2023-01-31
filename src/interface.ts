import chalk from "chalk";
import * as readline from "node:readline";
import { Command, CommandExecution } from "./commands";

import { GlobalState, ProgramOptions } from "./types";

export type Interface = {
  prompt(): void;
  welcome(): void;
};

export function createInterface(
  commands: Command<GlobalState, {}>[],
  programOptions: ProgramOptions
): Interface {
  let currentExecution: CommandExecution<GlobalState> | undefined;
  let globalState: GlobalState = {
    programOptions,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentExecution) {
      console.error("Hold your 🐴🐴 please.");
      return;
    }

    currentExecution = run(line);

    if (!currentExecution) {
      console.log("Huh?");
      prompt();
      return;
    }

    currentExecution.promise
      .then((newGlobalState) => {
        globalState = newGlobalState;
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        currentExecution = undefined;
        rl.prompt();
      });
  });

  rl.on("close", () => {
    process.exit();
  });

  return { prompt, welcome };

  function prompt() {
    rl.prompt();
  }

  function run(line: string): CommandExecution<GlobalState> | undefined {
    const args = line.split(/\s+/);

    const info = (message: string) => {
      console.log(message);
    };

    const prompt = (message: string): Promise<string> => {
      throw new Error("prompt() not implemented");
    };

    const updateState = (newState: GlobalState) => {
      globalState = newState;
    };

    const warning = (message: string) => {
      console.error("🙀 %s", chalk.dim(message));
    };

    for (let i = 0; i < commands.length; i++) {
      const options = commands[i].parseOptions([...args], globalState);
      if (!options) {
        continue;
      }

      return commands[i].run(globalState, options, {
        info,
        prompt,
        updateState,
        warning,
      });
    }
  }

  function welcome() {
    const { baseURL } = globalState.programOptions;
    console.log(`
  ${chalk.bold("Welcome to Login Buddy!")}
  
  This is a little helper for you if you're doing work on the 
  Login.gov frontend.
  
  Some commands:
  
  - ${chalk.bold("signup")} to create a new account
  - ${chalk.bold("verify")} to verify the account you just created
  - ${chalk.bold("screenshot")} to take screenshots
  
  We are using ${chalk.blue(`<${baseURL?.toString()}>`)} 
  (You can change this with the --env option.)
  
  `);
  }
}
