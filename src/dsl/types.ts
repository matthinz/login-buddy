import { Browser, Page } from "puppeteer";

/**
 * Options passed into a flow when it is being run.
 */
export type FlowRunOptions = {
  baseURL: string | URL;
  browser: Browser;
  page: Page;
  warn: (message: string) => void;
};

export type Stopper<InputState, OutputState extends InputState, Options> = (
  state: InputState & Partial<OutputState>,
  options: Options
) => Promise<boolean>;

/**
 * A Flow is a series of steps executed in a browser.
 */
export interface FlowInterface<
  InputState,
  OutputState extends InputState,
  Options
> {
  /**
   * Runs this flow and returns the generated state.
   */
  run(
    state: InputState,
    options?: Partial<FlowRunOptions & Options>
  ): Promise<OutputState>;

  /**
   * Runs this flow, optionally stopping & returning early.
   */
  run(
    state: InputState,
    options: Partial<FlowRunOptions & Options>,
    shouldStop: Stopper<InputState, OutputState, Options>
  ): Promise<InputState & Partial<OutputState>>;

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
    falseBranch: (
      start: FlowInterface<InputState, OutputState, Options>,
      state: OutputState,
      options: Options
    ) => FlowInterface<InputState, FalseOutputState, Options>
  ): FlowInterface<InputState, TrueOutputState | FalseOutputState, Options>;

  /**
   * Evaluates a function, passing in a Puppeteer page, the current state,
   * and the original options.
   */
  evaluate(
    func: (page: Page, state: OutputState, options: Options) => Promise<void>
  ): FlowInterface<InputState, OutputState, Options>;

  /**
   * Evaluates a function, passing in a Puppeteer page, the current state,
   * and the original options.
   * <func> can return a new state.
   */
  evaluateAndModifyState<NextOutputState extends OutputState>(
    func: (
      page: Page,
      state: OutputState,
      options: Options
    ) => Promise<NextOutputState>
  ): FlowInterface<InputState, NextOutputState, Options>;

  expectUrl(
    url: FromState<string | URL, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: FromState<Value, OutputState>
  ): FlowInterface<InputState, OutputState & { [K in Key]: Value }, Options>;

  navigateTo: (
    url: FromState<string | URL, OutputState>
  ) => FlowInterface<InputState, OutputState, Options>;

  // Actions that can be taken

  click(
    selector: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;

  // Selects a value in a drop-down
  select(
    selector: FromState<string, OutputState>,
    value: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;

  submit(
    selector?: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;

  type(
    selector: FromState<string, OutputState>,
    text: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;

  upload(
    selector: FromState<string, OutputState>,
    filename: FromState<string, OutputState>,
    contents?: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options>;
}

export type FromState<T, State> = T extends () => void
  ? never
  : T | ((state: State) => T | Promise<T>);
