import chalk from "chalk";
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

  return { prompt, welcome };

  function prompt() {
    rl.prompt();
  }

  function run(line: string): CommandExecution<GlobalState> | undefined {
    const args = line.split(/\s+/);

    const info = (message: string) => {
      console.log(message);
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
        ask,
        info,
        updateState,
        warning,
      });
    }
  }

  function ask(message: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      message = message.trim().replace(/:$/, "") + ":";

      if (message.length > 25) {
        message += "\n\n";
      }

      rl.question(message, (answer: string) => {
        resolve(answer);
      });
    });
  }
}
