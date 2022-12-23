import { Browser, Page } from "puppeteer";

/**
 * Options passed into a flow when it is being run.
 */
export type FlowRunOptions = {
  baseURL: string | URL;
  browser: () => Promise<Browser>;
  page: () => Promise<Page>;
};

/**
 * A Flow is a series of steps executed in a browser.
 */
export interface FlowInterface<State, Options> {
  /**
   * Runs this flow and returns the generated state.
   */
  run(options?: Partial<FlowRunOptions & Options>): Promise<State>;

  /**
   * Evaluates a function, passing in a Puppeteer page and
   * the current state.
   * @param func Evaluation function. Can return a new state.
   */
  evaluate(
    func: (page: Page, state: State) => Promise<void>
  ): FlowInterface<State, Options>;

  /**
   * Evaluates a function and allows modifying state.
   * @param func
   */
  evaluateAndModifyState<NextState extends State>(
    func: (page: Page, state: State) => Promise<NextState>
  ): FlowInterface<NextState, Options>;

  expectUrl(url: string | URL): FlowInterface<State, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: FromState<Value, State>
  ): FlowInterface<State & { [K in Key]: Value }, Options>;

  navigateTo: (url: string | URL) => FlowInterface<State, Options>;

  // Actions that can be taken

  click(selector: string): FlowInterface<State, Options>;

  submit(selector?: string): FlowInterface<State, Options>;

  type(
    selector: string | ((state: State) => string | Promise<string>),
    text: string | ((state: State) => string | Promise<string>)
  ): FlowInterface<State, Options>;

  upload(
    selector: string | ((state: State) => string | Promise<string>),
    filename: string | ((state: State) => string | Promise<string>),
    contents?: string | ((state: State) => string | Promise<string>)
  ): FlowInterface<State, Options>;
}

export type FromState<T, State> = T extends () => void
  ? never
  : T | ((state: State) => T | Promise<T>);
