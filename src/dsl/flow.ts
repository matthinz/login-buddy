import { promises as fs } from "fs";
import * as path from "path";
import { Page } from "puppeteer";

import { FlowHooks, FlowInterface, FlowRunOptions, FromState } from "./types";
import { resolveFromState } from "./util";

const DEFAULT_HOOKS = {
  info(message: string) {},
  async ask(message: string) {
    return undefined;
  },
  shouldStop() {
    return false;
  },
  warning(message: string) {},
};

type BuiltState<InputState, OutputState extends InputState> =
  | {
      isPartial: true;
      state: InputState & Partial<OutputState>;
    }
  | {
      isPartial: false;
      state: OutputState;
    };

type StateBuilder<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
> = (
  prevState: InputState,
  options: Options,
  hooks: FlowHooks<InputState, OutputState, Options>
) => Promise<BuiltState<InputState, OutputState>>;

export class Flow<
  InputState extends {},
  OutputState extends InputState,
  Options extends FlowRunOptions
> implements FlowInterface<InputState, OutputState, Options>
{
  private readonly _buildState: StateBuilder<InputState, OutputState, Options>;

  constructor(buildState: StateBuilder<InputState, OutputState, Options>) {
    this._buildState = buildState;
  }

  derive<NextOutputState extends OutputState>(
    func: (
      state: OutputState,
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => Promise<NextOutputState>
  ): FlowInterface<InputState, NextOutputState, Options> {
    return new Flow<InputState, NextOutputState, Options>(
      async (
        prevState,
        options,
        hooks
      ): Promise<BuiltState<InputState, NextOutputState>> => {
        // First, we need to make sure our state is ok _up to this point_.
        const { state, isPartial } = await this._buildState(
          prevState,
          options,
          hooks as FlowHooks<InputState, OutputState, Options>
        );

        if (isPartial) {
          // Partial state indicates that we've been told to stop.
          return {
            state: state as InputState & Partial<NextOutputState>,
            isPartial: true,
          };
        }

        // Now see if we should stop.
        const stop = await hooks.shouldStop(
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
          state: await func(state as OutputState, options, hooks),
          isPartial: false,
        };
      }
    );
  }

  askIfNeeded<Key extends string>(
    key: FromState<Key, OutputState>,
    message: FromState<string, OutputState>,
    normalizer?: (
      input: string
    ) => string | undefined | Promise<string | undefined>
  ): FlowInterface<InputState, OutputState & { [K in Key]: string }, Options> {
    return this.derive(
      async (
        state,
        _options,
        hooks
      ): Promise<OutputState & { [K in Key]: string }> => {
        let value: string | undefined;
        const resolvedKey = await resolveFromState(key, state);

        if (state) {
          const existingValue = (state as Record<string, unknown>)[resolvedKey];
          if (existingValue != null) {
            value = String(existingValue);
          }
        }

        const resolvedMessage = await resolveFromState(message, state);

        while (true) {
          if (value != null && normalizer) {
            value = await normalizer(value);
          }

          if (value != null) {
            return {
              ...state,
              [resolvedKey]: value,
            } as OutputState & { [K in Key]: string };
          }

          value = await hooks.ask(resolvedMessage);
        }
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
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => FlowInterface<OutputState, TrueOutputState, Options>,
    falseBranch?: (
      start: FlowInterface<InputState, OutputState, Options>,
      state: OutputState,
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => FlowInterface<OutputState, FalseOutputState, Options>
  ): FlowInterface<InputState, TrueOutputState | FalseOutputState, Options> {
    return this.derive<TrueOutputState | FalseOutputState>(
      async (state, options, hooks) => {
        const { page } = options;
        const result = await check(page, state, options);

        const start = new Flow<InputState, OutputState, Options>(() =>
          Promise.resolve({ state, isPartial: false })
        );

        let flow: FlowInterface<
          InputState,
          TrueOutputState | FalseOutputState,
          Options
        >;

        if (result) {
          flow = trueBranch(start, state, options, hooks);
        } else if (falseBranch) {
          flow = falseBranch(start, state, options, hooks);
        } else {
          flow = start as unknown as FlowInterface<
            InputState,
            FalseOutputState,
            Options
          >;
        }

        // XXX: Types get a little wishy-washy here due
        //      to .shouldStop()

        return (await flow.run(state, options, hooks)) as
          | TrueOutputState
          | FalseOutputState;
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

  evaluate<NextOutputState extends OutputState>(
    funcToEval: (
      page: Page,
      state: OutputState,
      options: Options,
      hooks: FlowHooks<InputState, OutputState, Options>
    ) => Promise<NextOutputState>
  ) {
    return this.derive(async (state, options, hooks) => {
      const { page } = options;
      const nextState = await funcToEval(page, state, options, hooks);
      return nextState == null ? state : nextState;
    });
  }

  expectUrl(url: FromState<string | URL, OutputState>) {
    return this.derive(async (state: OutputState, options: Options, hooks) => {
      let resolvedUrl = await resolveFromState(url, state);

      if (options.baseURL) {
        resolvedUrl = new URL(resolvedUrl.toString(), options.baseURL);
      }

      const { page } = options;

      if (page.url() !== resolvedUrl.toString()) {
        hooks.warning(`Expected '${resolvedUrl}', got '${page.url()}'`);
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
    hooks: FlowHooks<InputState, OutputState, Options>
  ): Promise<InputState & Partial<OutputState>>;
  run(initialState: InputState, options: Options): Promise<OutputState>;
  run(
    initialState: InputState,
    options: Options,
    hooks?: Partial<FlowHooks<InputState, OutputState, Options>>
  ): Promise<OutputState> | Promise<InputState & Partial<OutputState>> {
    return this._buildState(initialState, options, {
      ...DEFAULT_HOOKS,
      ...(hooks ?? {}),
    }).then(({ state }) => state);
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
