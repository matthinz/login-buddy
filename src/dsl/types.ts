import { Browser, Page } from "puppeteer";

/**
 * A Flow is a series of steps executed in a browser.
 */
export type Flow<State> = {
  /**
   * Runs this flow and returns the generated state.
   */
  run(options?: FlowRunOptions): Promise<State>;

  /**
   * Evaluates a function, passing in a Puppeteer page and
   * the current state.
   * @param func Evaluation function. Can return a new state.
   */
  evaluate(func: (page: Page, state: State) => Promise<void>): Flow<State>;

  /**
   * Evaluates a function and allows modifying state.
   * @param func
   */
  evaluateAndModifyState<NextState extends State>(
    func: (page: Page, state: State) => Promise<NextState>
  ): Flow<NextState>;

  expectUrl(url: string | URL): Flow<State>;

  generate<Key extends string, Value>(
    key: Key,
    generator: (state: State) => Value | Promise<Value>
  ): Flow<State & { [K in Key]: Value }>;

  passTo<OtherState extends State>(
    otherFlow: Flow<OtherState>
  ): Flow<State & OtherState>;

  skipNavigation(): Flow<State>;

  // Actions that can be taken

  click(selector: string): Flow<State>;

  submit(selector?: string): Flow<State>;

  type(
    selector: string | ((state: State) => string | Promise<string>),
    text: string | ((state: State) => string | Promise<string>)
  ): Flow<State>;

  upload(
    selector: string | ((state: State) => string | Promise<string>),
    filename: string | ((state: State) => string | Promise<string>),
    contents?: string | ((state: State) => string | Promise<string>)
  ): Flow<State>;
};

/**
 * Options passed into a flow when it is being run.
 */
export type FlowRunOptions = {
  baseURL?: string | URL;
  browser?: Browser;
  page?: Page;
  skipNavigation?: boolean;
};

export type FlowParams<State> = {
  browser?: Browser;
  page?: Page;
  options?: FlowRunOptions;
  state: State;
};
