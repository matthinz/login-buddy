import { launch, Browser, Page } from "puppeteer";

export type FlowRunOptions = {
  baseURL?: string | URL;
  browser?: Browser;
};

type FlowParams<State> = {
  browser?: Browser;
  page?: Page;
  options?: FlowRunOptions;
  state: State;
};

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

  expectUrl(url: string | URL): Flow<State>;

  generate<Key extends string, Value>(
    key: Key,
    generator: (state: State) => Value | Promise<Value>
  ): Flow<State & { [K in Key]: Value }>;

  // Actions that can be taken

  click(selector: string): Flow<State>;

  submit(selector?: string): Flow<State>;

  type(
    selector: string | ((state: State) => string | Promise<string>),
    text: string | ((state: State) => string | Promise<string>)
  ): Flow<State>;
};

/**
 * Starts a new flow, navigated to the given URL.
 * @param url
 */
export function navigateTo(url: string | URL): Flow<{}> {
  const params: FlowParams<{}> = {
    state: {},
  };

  return createFlow(params, async (page, state, options) => {
    if (options.baseURL) {
      url = new URL(
        url.toString(),
        options.baseURL ? options.baseURL.toString() : undefined
      );
    }

    console.error("navigateTo %s", url);

    await page.goto(url.toString());

    return state;
  });
}

/**
 *
 * @param state
 * @returns
 */
function createFlow<PrevState, State extends PrevState>(
  params: FlowParams<PrevState>,
  func: (
    page: Page,
    state: PrevState,
    options: FlowRunOptions
  ) => Promise<State>
): Flow<State> {
  return {
    evaluate,
    expectUrl,
    click,
    generate,
    run,
    submit,
    type,
  };

  async function run(options?: FlowRunOptions): Promise<State> {
    const browser = options?.browser ?? params.browser ?? (await launch());
    const page = params.page ?? (await browser.newPage());

    const nextOptions: FlowRunOptions = {
      ...(options ?? {}),
    };

    return await func(page, params.state, nextOptions);
  }

  function click(
    selector: string | ((state: State) => string | Promise<string>)
  ): Flow<State> {
    return createFlow(params, async (page, state, options) => {
      const nextState = await func(page, state, options);

      selector =
        typeof selector === "function" ? await selector(nextState) : selector;

      await page.click(selector);

      return nextState;
    });
  }

  function evaluate(
    funcToEval: (page: Page, state: State) => Promise<void>
  ): Flow<State> {
    return createFlow(params, async (page, state, options) => {
      const nextState = await func(page, state, options);
      await funcToEval(page, nextState);
      return nextState;
    });
  }

  function expectUrl(
    url:
      | string
      | URL
      | ((state: State) => string | URL | Promise<string> | Promise<URL>)
  ) {
    return createFlow(params, async (page, state, options) => {
      const nextState = await func(page, state, options);
      url = (typeof url === "function" ? await url(nextState) : url).toString();

      if (options.baseURL) {
        url = new URL(url.toString(), options.baseURL);
      }

      if (page.url() !== url.toString()) {
        console.error("Expected to be at '%s', but at '%s'", url, page.url());
      }

      return nextState;
    });
  }

  function generate<Key extends string, Value>(
    key: Key,
    generator: (state: State) => Value | Promise<Value>
  ): Flow<State & { [K in Key]: Value }> {
    return createFlow(params, async (page, state, options) => {
      const nextState: State = await func(page, state, options);
      const value: Value = await generator(nextState);
      return { ...nextState, [key]: value };
    }) as Flow<State & { [K in Key]: Value }>;
  }

  function submit(
    selector?: string | ((state: State) => string | Promise<string>)
  ): Flow<State> {
    return createFlow(params, async (page, state, options) => {
      const nextState = await func(page, state, options);

      selector = selector ?? "button[type=submit]";
      selector =
        typeof selector === "function" ? await selector(nextState) : selector;

      console.error("submit %s", selector);
      await Promise.all([page.click(selector), page.waitForNavigation()]);
      return nextState;
    });
  }

  function type(
    selector: string | ((state: State) => string | Promise<string>),
    text: string | ((state: State) => string | Promise<string>)
  ): Flow<State> {
    return createFlow(params, async (page, state, options) => {
      const nextState = await func(page, state, options);

      text = typeof text === "function" ? await text(nextState) : text;
      selector =
        typeof selector === "function" ? await selector(nextState) : selector;

      await page.type(selector, text);

      return nextState;
    });
  }
}
