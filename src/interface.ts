import * as readline from "node:readline";

import { Command, GlobalState, ProgramOptions } from "./types";

export type Interface = {
  prompt(): void;
  run(line: string): Promise<void>;
  welcome(): void;
};

export function createInterface(
  commands: Command[],
  programOptions: ProgramOptions
): Interface {
  let currentCommandPromise: Promise<void> | undefined;
  let globalState: GlobalState = {
    programOptions,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  rl.on("line", (line) => {
    if (currentCommandPromise) {
      console.error("Hold your 🐴🐴 please.");
      return;
    }

    currentCommandPromise = run(line).finally(() => {
      currentCommandPromise = undefined;
      rl.prompt();
    });
  });

  rl.on("close", () => {
    process.exit();
  });

  return { prompt, run, welcome };

  function prompt() {
    rl.prompt();
  }

  async function run(line: string): Promise<void> {
    let promise: Promise<GlobalState> | undefined;

    for (let i = 0; i < commands.length; i++) {
      promise = commands[i].runFromUserInput(line, globalState);
      if (promise) {
        break;
      }
    }

    if (!promise) {
      console.log("Huh?");
      prompt();
      return;
    }

    try {
      globalState = await promise;
    } catch (err) {
      console.error(err);
    }
  }

  function welcome() {
    const { baseURL } = globalState.programOptions;
    console.log(`
  Welcome to Login Buddy!
  
  This is a little helper for you if you're doing work on the Login.gov frontend.
  
  Some commands:
  
  - 'signup' to create a new account
  - 'verify' to verify the account you just created
  - 'screenshot' to take screenshots
  
  We are using <${baseURL?.toString()}> 
  (You can change this with the --env option.)
  
  `);
  }
}
