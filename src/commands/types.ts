import { GlobalState } from "../types";

export interface Command<Parameters, State> {
  /**
   * Called to parse user input into parameters for the command.
   */
  parse(args: string[], state: State): Parameters | undefined;

  /**
   * Runs the command.
   */
  run(params: Parameters, state: State): CommandExecution<State>;
}

export interface CommandExecution<State> {
  abort(): void;

  /**
   * Promise that resolves when execution completes.
   */
  readonly promise: Promise<State>;
}
