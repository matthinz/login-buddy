import { promises as fs } from "fs";
import * as path from "path";
import { Page } from "puppeteer";

import { FlowInterface, FlowRunOptions, FromState, Stopper } from "./types";
import { resolveFromState } from "./util";

const NEVER_STOP = () => Promise.resolve(false);

type BuiltState<InputState, OutputState extends InputState> =
  | {
      isPartial: true;
      state: InputState & Partial<OutputState>;
    }
  | {
      isPartial: false;
      state: OutputState;
    };

type StateBuilder<InputState, OutputState extends InputState, Options> = (
  prevState: InputState,
  options: Options,
  shouldStop: Stopper<InputState, OutputState, Options>
) => Promise<BuiltState<InputState, OutputState>>;

export class Flow<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
> implements FlowInterface<InputState, OutputState, Options>
{
  private readonly _buildState: StateBuilder<InputState, OutputState, Options>;

  constructor(buildState: StateBuilder<InputState, OutputState, Options>) {
    this._buildState = buildState;
  }

  derive<NextOutputState extends OutputState>(
    func: (state: OutputState, options: Options) => Promise<NextOutputState>
  ): FlowInterface<InputState, NextOutputState, Options> {
    return new Flow<InputState, NextOutputState, Options>(
      async (
        prevState,
        options,
        shouldStop
      ): Promise<BuiltState<InputState, NextOutputState>> => {
        // First, we need to make sure our state is ok _up to this point_.
        const { state, isPartial } = await this._buildState(
          prevState,
          options,
          shouldStop as Stopper<InputState, OutputState, Options>
        );

        if (isPartial) {
          // Partial state indicates that we've been told to stop.
          return {
            state: state as InputState & Partial<NextOutputState>,
            isPartial: true,
          };
        }

        // Now see if we should stop.
        const stop = await shouldStop(
          state as InputState & Partial<NextOutputState>,
          options
        );

        if (stop) {
          return {
            state: state as InputState & Partial<NextOutputState>,
            isPartial: true,
          };
        }

        // Since the state is not partial, we can safely treat it as though
        // it's been returned to us by this._getState
        return {
          state: await func(state as OutputState, options),
          isPartial: false,
        };
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
          Promise.resolve({ state, isPartial: false })
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

  run(
    initialState: InputState,
    options: Options,
    shouldStop: Stopper<InputState, OutputState, Options>
  ): Promise<InputState & Partial<OutputState>>;
  run(initialState: InputState, options: Options): Promise<OutputState>;
  run(
    initialState: InputState,
    options: Options,
    shouldStop?: Stopper<InputState, OutputState, Options>
  ): Promise<OutputState> | Promise<InputState & Partial<OutputState>> {
    return this._buildState(
      initialState,
      options,
      shouldStop ?? NEVER_STOP
    ).then(({ state }) => state);
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
