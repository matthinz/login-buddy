import { Page } from "puppeteer";

/**
 * Options passed into a flow when it is being run.
 */
export type FlowRunOptions = {
  /**
   * URL used as a base for other URLs in the flow.
   */
  baseURL: URL;

  /**
   * Puppeteer page in which to operate.
   */
  page: Page;
};

/**
 * Hooks are extension points used to customize the
 * behavior of a Flow.
 */
export type FlowHooks<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
> = {
  /**
   * Hook to prompt the user for input.
   */
  ask(message: string): Promise<string | undefined>;

  info(message: string): void;

  /**
   * Returns `true` if the flow should stop processing at this point.
   */
  shouldStop(
    state: InputState & Partial<OutputState>,
    options: Options
  ): boolean | Promise<boolean>;

  /**
   * Called to emit a warning message.
   * @param message
   */
  warning(message: string): void;
};

/**
 * A Flow is a series of steps executed in a browser.
 */
export interface FlowInterface<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
> {
  /**
   * Runs this flow and returns the generated state.
   */
  run(state: InputState, options: Options): Promise<OutputState>;

  /**
   * Runs this flow, incorporating the given hooks, and returns
   * the generated state.
   * (Note that this could result in a partial run.)
   */
  run(
    state: InputState,
    options: Options,
    hooks: Partial<FlowHooks<InputState, OutputState, Options>>
  ): Promise<InputState & Partial<OutputState>>;

  askIfNeeded<Key extends string>(
    key: FromStateAndOptions<Key, OutputState, Options>,
    message: FromStateAndOptions<string, OutputState, Options>,
    normalizer?: (
      input: string
    ) => string | undefined | Promise<string | undefined>
  ): FlowInterface<InputState, OutputState & { [K in Key]: string }, Options>;

  branch<
    TrueOutputState extends OutputState,
    FalseOutputState extends OutputState
  >(
    check: (
      page: Page,
      state: OutputState,
      options: Options
    ) => boolean | Promise<boolean>,
    trueBranch: (
      start: FlowInterface<InputState, OutputState, Options>,
      state: OutputState,
      options: Options
    ) => FlowInterface<InputState, TrueOutputState, Options>,
    falseBranch?: (
      start: FlowInterface<InputState, OutputState, Options>,
      state: OutputState,
      options: Options
    ) => FlowInterface<InputState, FalseOutputState, Options>
  ): FlowInterface<InputState, TrueOutputState | FalseOutputState, Options>;

  /**
   * Evaluates a function and allows modifying state.
   */
  evaluate<NextOutputState extends OutputState>(
    func: (
      page: Page,
      state: OutputState,
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => Promise<NextOutputState>
  ): FlowInterface<InputState, NextOutputState, Options>;

  evaluate(
    func: (
      page: Page,
      state: OutputState,
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => Promise<void>
  ): FlowInterface<InputState, OutputState, Options>;

  expectUrl(
    url: FromStateAndOptions<string | URL, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: FromStateAndOptions<Value, OutputState, Options>
  ): FlowInterface<InputState, OutputState & { [K in Key]: Value }, Options>;

  navigateTo(
    url: FromStateAndOptions<string | URL, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  // Actions that can be taken

  click(
    selector: FromStateAndOptions<string, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  // Selects a value in a drop-down
  select(
    selector: FromStateAndOptions<string, OutputState, Options>,
    value: FromStateAndOptions<string, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  submit(
    selector?: FromStateAndOptions<string, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  then<NextOutputState extends OutputState>(
    next: (
      flow: FlowInterface<OutputState, OutputState, Options>,
      state: OutputState
    ) => FlowInterface<OutputState, NextOutputState, Options>
  ): FlowInterface<InputState, NextOutputState, Options>;

  type(
    selector: FromStateAndOptions<string, OutputState, Options>,
    text: FromStateAndOptions<string, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;

  upload(
    selector: FromStateAndOptions<string, OutputState, Options>,
    filename: FromStateAndOptions<string, OutputState, Options>,
    contents?: FromStateAndOptions<string, OutputState, Options>
  ): FlowInterface<InputState, OutputState, Options>;
}

export type FromStateAndOptions<
  T,
  State,
  Options extends FlowRunOptions
> = T extends () => void
  ? never
  : T | ((state: State, options: Options) => T | Promise<T>);
