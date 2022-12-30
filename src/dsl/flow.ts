import { promises as fs } from "fs";
import * as path from "path";
import { Page } from "puppeteer";

import { FlowInterface, FlowRunOptions, FromState } from "./types";
import { resolveFromState } from "./util";

type GetState<InputState, OutputState extends InputState, Options> = (
  prevState: InputState,
  options: Options
) => Promise<OutputState>;

export class Flow<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
> implements FlowInterface<InputState, OutputState, Options>
{
  private readonly _getState: GetState<InputState, OutputState, Options>;

  constructor(getState: GetState<InputState, OutputState, Options>) {
    this._getState = getState;
  }

  derive<NextOutputState extends OutputState>(
    func: (state: OutputState, options: Options) => Promise<NextOutputState>
  ): FlowInterface<InputState, NextOutputState, Options> {
    return new Flow<InputState, NextOutputState, Options>(
      async (prevState, options: Options) => {
        const state = await this._getState(prevState, options);
        return func(state, options);
      }
    );
  }

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
    ) => FlowInterface<OutputState, TrueOutputState, Options>,
    falseBranch: (
      start: FlowInterface<InputState, OutputState, Options>,
      state: OutputState,
      options: Options
    ) => FlowInterface<OutputState, FalseOutputState, Options>
  ): FlowInterface<InputState, TrueOutputState | FalseOutputState, Options> {
    return this.derive<TrueOutputState | FalseOutputState>(
      async (state, options) => {
        const { page } = options;
        const result = await check(page, state, options);

        const start = new Flow<InputState, OutputState, Options>(() =>
          Promise.resolve(state)
        );

        const flow = result
          ? trueBranch(start, state, options)
          : falseBranch(start, state, options);

        const nextState = await flow.run(state, options);
        return nextState;
      }
    );
  }

  click(selector: FromState<string, OutputState>) {
    return this.derive(async (state, options) => {
      const { page } = options;
      selector = await resolveFromState(selector, state);

      await page.click(selector);

      return state;
    });
  }

  evaluate(
    funcToEval: (
      page: Page,
      state: OutputState,
      options: Options
    ) => Promise<void>
  ) {
    return this.derive(async (state, options) => {
      const { page } = options;
      await funcToEval(page, state, options);
      return state;
    });
  }

  evaluateAndModifyState<NextState extends OutputState>(
    funcToEval: (
      page: Page,
      state: OutputState,
      options: Options
    ) => Promise<NextState>
  ) {
    return this.derive(async (state: OutputState, options: Options) => {
      const { page } = options;
      const modifiedState = await funcToEval(page, state, options);
      return modifiedState;
    });
  }

  expectUrl(url: FromState<string | URL, OutputState>) {
    return this.derive(async (state: OutputState, options: Options) => {
      let resolvedUrl = await resolveFromState(url, state);

      if (options.baseURL) {
        resolvedUrl = new URL(resolvedUrl.toString(), options.baseURL);
      }

      const { page } = options;

      if (page.url() !== resolvedUrl.toString()) {
        console.error(
          "Expected to be at '%s', but at '%s'",
          resolvedUrl,
          page.url()
        );
      }

      return state;
    });
  }

  generate<Key extends string, Value>(
    key: Key,
    value: FromState<Value, OutputState>
  ): FlowInterface<InputState, OutputState & { [K in Key]: Value }, Options> {
    return this.derive(async (state) => {
      const resolvedValue = await resolveFromState(value, state);
      return { ...state, [key]: resolvedValue };
    }) as FlowInterface<
      InputState,
      OutputState & { [K in Key]: Value },
      Options
    >;
  }

  navigateTo(url: FromState<string | URL, OutputState>) {
    return this.derive(async (state, options) => {
      const { page } = options;

      let resolvedUrl = await resolveFromState(url, state);
      resolvedUrl = new URL(resolvedUrl, options.baseURL);
      await page.goto(resolvedUrl.toString());

      return state;
    });
  }

  run(initialState: InputState, options: Options): Promise<OutputState> {
    return this._getState(initialState, options);
  }

  select(
    selector: FromState<string, OutputState>,
    value: FromState<string, OutputState>
  ): FlowInterface<InputState, OutputState, Options> {
    return this.derive(async (state, options) => {
      const [resolvedSelector, resolvedValue] = await Promise.all([
        resolveFromState(selector, state),
        resolveFromState(value, state),
      ]);
      const { page } = options;

      await page.select(resolvedSelector, resolvedValue);

      return state;
    });
  }

  submit(selector?: FromState<string, OutputState>) {
    return this.derive(async (state, options) => {
      const resolvedSelector =
        selector == null
          ? "button[type=submit]"
          : await resolveFromState(selector, state);

      const { page } = options;

      await Promise.all([
        page.click(resolvedSelector),
        page.waitForNavigation(),
      ]);

      await page.waitForNetworkIdle();

      return state;
    });
  }

  type(
    selector: FromState<string, OutputState>,
    text: FromState<string, OutputState>
  ) {
    return this.derive(async (state, options) => {
      const [resolvedText, resolvedSelector] = await Promise.all([
        resolveFromState(text, state),
        resolveFromState(selector, state),
      ]);

      const { page } = options;

      await page.waitForSelector(resolvedSelector, {
        timeout: 3000,
      });

      await page.type(resolvedSelector, resolvedText);

      return state;
    });
  }

  upload(
    selector: FromState<string, OutputState>,
    filename: FromState<string, OutputState>,
    contents?: FromState<string, OutputState>
  ) {
    return this.derive(async (state, options) => {
      const [resolvedSelector, resolvedFilename, resolvedContents] =
        await Promise.all([
          resolveFromState(selector, state),
          resolveFromState(filename, state),
          contents == null
            ? Promise.resolve(undefined)
            : resolveFromState(contents, state),
        ]);

      const tempFile = path.join(".tmp", resolvedFilename);
      await fs
        .mkdir(path.dirname(tempFile), {
          recursive: true,
        })
        .catch((err) => {
          console.error(err);
        });
      await fs.writeFile(tempFile, resolvedContents ?? "");

      const { page } = options;

      await page.waitForSelector(resolvedSelector, { timeout: 3000 });

      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(resolvedSelector),
      ]);

      await fileChooser.accept([path.resolve(tempFile)]);

      return state;
    });
  }
}