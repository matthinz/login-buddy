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
      url = await resolveFromState(url, state);

      if (options.baseURL) {
        url = new URL(url.toString(), options.baseURL);
      }

      const { page } = options;

      if (page.url() !== url.toString()) {
        console.error("Expected to be at '%s', but at '%s'", url, page.url());
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

      url = await resolveFromState(url, state);
      url = new URL(url, options.baseURL);
      await page.goto(url.toString());

      return state;
    });
  }

  run(initialState: InputState, options: Options): Promise<OutputState> {
    return this._getState(initialState, options);
  }

  submit(selector?: FromState<string, OutputState>) {
    return this.derive(async (state, options) => {
      selector =
        selector == null
          ? "button[type=submit]"
          : await resolveFromState(selector, state);

      const { page } = options;

      await Promise.all([page.click(selector), page.waitForNavigation()]);

      await page.waitForNetworkIdle();

      return state;
    });
  }

  type(
    selector: FromState<string, OutputState>,
    text: FromState<string, OutputState>
  ) {
    return this.derive(async (state, options) => {
      [text, selector] = await Promise.all([
        resolveFromState(text, state),
        resolveFromState(selector, state),
      ]);

      const { page } = options;

      await page.waitForSelector(selector, {
        timeout: 3000,
      });

      await page.type(selector, text);

      return state;
    });
  }

  upload(
    selector: FromState<string, OutputState>,
    filename: FromState<string, OutputState>,
    contents?: FromState<string, OutputState>
  ) {
    return this.derive(async (state, options) => {
      [selector, filename, contents] = await Promise.all([
        resolveFromState(selector, state),
        resolveFromState(filename, state),
        contents == null
          ? Promise.resolve(undefined)
          : resolveFromState(contents, state),
      ]);

      const tempFile = path.join(".tmp", filename);
      await fs
        .mkdir(path.dirname(tempFile), {
          recursive: true,
        })
        .catch((err) => {
          console.error(err);
        });
      await fs.writeFile(tempFile, contents ?? "");

      const { page } = options;

      await page.waitForSelector(selector, { timeout: 3000 });

      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector),
      ]);

      await fileChooser.accept([path.resolve(tempFile)]);

      return state;
    });
  }
}
