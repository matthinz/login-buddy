import { promises as fs } from "fs";
import * as path from "path";
import { Page } from "puppeteer";

import { FlowInterface, FlowRunOptions, FromState } from "./types";
import { resolveFromState } from "./util";

type GetState<State, Options extends FlowRunOptions> = (
  options: Options
) => Promise<State>;

export class Flow<State, Options extends FlowRunOptions>
  implements FlowInterface<State, Options>
{
  private readonly _getState: GetState<State, Options>;
  private readonly _options: Options;

  constructor(getState: GetState<State, Options>, options: Options) {
    this._getState = getState;
    this._options = options;
  }

  derive<NextState extends State>(
    func: (state: State, options: Options) => Promise<NextState>
  ): FlowInterface<NextState, Options> {
    return new Flow<NextState, Options>(async (options: Options) => {
      const state = await this._getState(options);
      return func(state, options);
    }, this._options);
  }

  click(selector: FromState<string, State>) {
    return this.derive(async (state, options) => {
      const page = await options.page();
      selector = await resolveFromState(selector, state);

      await page.click(selector);

      return state;
    });
  }

  evaluate(
    funcToEval: (page: Page, state: State, options: Options) => Promise<void>
  ) {
    return this.derive(async (state, options) => {
      const page = await options.page();
      await funcToEval(page, state, options);
      return state;
    });
  }

  evaluateAndModifyState<NextState extends State>(
    funcToEval: (
      page: Page,
      state: State,
      options: Options
    ) => Promise<NextState>
  ) {
    return this.derive(async (state: State, options: Options) => {
      const page = await options.page();
      const modifiedState = await funcToEval(page, state, options);
      return modifiedState;
    });
  }

  expectUrl(url: FromState<string | URL, State>) {
    return this.derive(async (state: State, options: Options) => {
      url = await resolveFromState(url, state);

      if (options.baseURL) {
        url = new URL(url.toString(), options.baseURL);
      }

      const page = await options.page();

      if (page.url() !== url.toString()) {
        console.error("Expected to be at '%s', but at '%s'", url, page.url());
      }

      return state;
    });
  }

  generate<Key extends string, Value>(
    key: Key,
    value: FromState<Value, State>
  ): FlowInterface<State & { [K in Key]: Value }, Options> {
    return this.derive(async (state) => {
      const resolvedValue = await resolveFromState(value, state);
      return { ...state, [key]: resolvedValue };
    }) as FlowInterface<State & { [K in Key]: Value }, Options>;
  }

  navigateTo(url: FromState<string | URL, State>) {
    return this.derive(async (state, options) => {
      const page = await options.page();

      url = await resolveFromState(url, state);
      url = new URL(url, options.baseURL);
      await page.goto(url.toString());

      return state;
    });
  }

  run(options?: Partial<Options>): Promise<State> {
    const actualOptions = {
      ...this._options,
      ...(options ?? {}),
    };

    return this._getState(actualOptions);
  }

  submit(selector?: FromState<string, State>) {
    return this.derive(async (state, options) => {
      selector =
        selector == null
          ? "button[type=submit]"
          : await resolveFromState(selector, state);

      const page = await options.page();

      await Promise.all([page.click(selector), page.waitForNavigation()]);

      await page.waitForNetworkIdle();

      return state;
    });
  }

  type(selector: FromState<string, State>, text: FromState<string, State>) {
    return this.derive(async (state, options) => {
      [text, selector] = await Promise.all([
        resolveFromState(text, state),
        resolveFromState(selector, state),
      ]);

      const page = await options.page();

      await page.waitForSelector(selector, {
        timeout: 3000,
      });

      await page.type(selector, text);

      return state;
    });
  }

  upload(
    selector: FromState<string, State>,
    filename: FromState<string, State>,
    contents?: FromState<string, State>
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

      const page = await options.page();

      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector);

      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector),
      ]);

      await fileChooser.accept([path.resolve(tempFile)]);

      return state;
    });
  }
}
