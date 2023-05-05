import { Page } from "puppeteer";

export type RawValue = string | number | boolean | object | URL | Buffer;

export type Action<State, Options> =
  | AssertAction<State, Options>
  | ClickAction<State, Options>
  | SelectAction<State, Options>
  | SubmitAction<State, Options>
  | ExpectUrlAction<State, Options>
  | NavigateAction<State, Options>
  | TypeAction<State, Options>
  | UploadAction<State, Options>;

export type RuntimeValue<T extends RawValue, State, Options> =
  | T
  | ((context: Context<State, Options>) => T | Promise<T>);

export type AssertAction<State, Options> = {
  readonly type: "assert";
  message(context: Context<State, Options>): Promise<string>;
  check(context: Context<State, Options>): Promise<boolean>;
  perform: (context: Context<State, Options>) => Promise<void>;
};

export type Context<State, Options> = Readonly<{
  hooks: FlowHooks;
  options: Options;
  page: Page;
  state: State;
}>;

export type ClickAction<State, Options> = {
  readonly type: "click";
  selector(context: Context<State, Options>): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type ExpectUrlAction<State, Options> = {
  readonly type: "expect_url";
  url(context: Context<State, Options>): Promise<URL>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type NavigateAction<State, Options> = {
  readonly type: "navigate";
  url(context: Context<State, Options>): Promise<URL>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type SelectAction<State, Options> = {
  readonly type: "select";
  selector(context: Context<State, Options>): Promise<string>;
  value(context: Context<State, Options>): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type SubmitAction<State, Options> = {
  readonly type: "submit";
  selector(context: Context<State, Options>): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type TypeAction<State, Options> = {
  readonly type: "type";
  selector(context: Context<State, Options>): Promise<string>;
  value(context: Context<State, Options>): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type UploadAction<State, Options> = {
  readonly type: "upload";
  selector(context: Context<State, Options>): Promise<string>;
  contents(context: Context<State, Options>): Promise<string | Buffer>;
  filename(context: Context<State, Options>): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export interface FlowHooks {
  /**
   * Prompts the user for some information.
   * @param prompt
   */
  ask(prompt: string): Promise<string | undefined>;
}

export type FlowResult<InputState, State extends InputState> =
  | {
      completed: true;
      state: State;
    }
  | {
      completed: false;
      state: InputState extends {} ? InputState & Partial<State> : InputState;
    };

export interface FlowBuilderInterface<
  InputState,
  State extends InputState,
  Options
> {
  askIfNeeded<Key extends string>(
    key: Key,
    prompt: string,
    normalizer?: (input: string) => string | Promise<string>
  ): FlowBuilderInterface<
    InputState,
    State & { [key in Key]: string },
    Options
  >;

  branch<TrueState extends State, FalseState extends State>(
    check: (
      context: Context<State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<State, Options>
    ) => FlowBuilderInterface<State, TrueState, Options>,
    ifFalse: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<State, Options>
    ) => FlowBuilderInterface<State, FalseState, Options>
  ): FlowBuilderInterface<InputState, TrueState | FalseState, Options>;

  click(selector: string): FlowBuilderInterface<InputState, State, Options>;

  click(
    selector: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  expect(url: string | URL): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => Promise<string | URL>
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: string | URL,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => string | URL,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => Promise<string | URL>,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: (context: Context<State, Options>) => Value | Promise<Value>
  ): FlowBuilderInterface<InputState, State & { [key in Key]: Value }, Options>;

  navigateTo(url: string): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(url: URL): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(
    url: RuntimeValue<string | URL, State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  run(
    context: Context<InputState, Options>
  ): Promise<FlowResult<InputState, State>>;

  select(
    selector: string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: (context: Context<State, Options>) => Promise<string> | string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: string,
    value: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: (context: Context<State, Options>) => Promise<string> | string,
    value: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  submit(): FlowBuilderInterface<InputState, State, Options>;

  submit(selector: string): FlowBuilderInterface<InputState, State, Options>;

  submit(
    selector: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  then<NextState extends State>(
    next: (
      flow: FlowBuilderInterface<InputState, State, Options>
    ) => FlowBuilderInterface<InputState, NextState, Options>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  type(
    selector: string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: string,
    value: (context: Context<State, Options>) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (context: Context<State, Options>) => string | Promise<string>,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (context: Context<State, Options>) => string | Promise<string>,
    value: (context: Context<State, Options>) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State, Options>;

  upload(
    selector: RuntimeValue<string, State, Options>,
    filename: RuntimeValue<string, State, Options>,
    contents: RuntimeValue<string | Buffer, State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  when<NextState extends State>(
    check: (
      context: Context<State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<State, Options>
    ) => FlowBuilderInterface<State, NextState, Options>
  ): FlowBuilderInterface<InputState, State | NextState, Options>;
}
