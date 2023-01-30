import { FlowRunOptions } from "../dsl";

export type CommandHooks<GlobalState> = {
  info(message: string): void;

  /**
   * Called to synchronously update global state.
   */
  updateState: (newState: GlobalState) => void;

  /**
   * Emits a warning to the user.
   */
  warning: (message: string) => void;
};

export interface Command<GlobalState extends {}, Options extends {}> {
  /**
   * Called to parse user input into options for the command.
   */
  parseOptions(args: string[], globalState: GlobalState): Options | undefined;

  /**
   * Runs the command.
   */
  run(
    globalState: GlobalState,
    options: Options,
    hooks: CommandHooks<GlobalState>
  ): CommandExecution<GlobalState>;
}

export interface CommandExecution<GlobalState> {
  abort(): void;

  /**
   * Promise that resolves when execution completes.
   */
  readonly promise: Promise<GlobalState>;
}
