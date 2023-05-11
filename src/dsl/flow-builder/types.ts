import { Frame, Page } from "puppeteer";

export type RawValue = string | number | boolean | object | URL | Buffer;

export type Action<InputState extends {}, State extends InputState, Options> =
  | AssertAction<InputState, State, Options>
  | ClickAction<InputState, State, Options>
  | SelectAction<InputState, State, Options>
  | SubmitAction<InputState, State, Options>
  | ExpectUrlAction<InputState, State, Options>
  | NavigateAction<InputState, State, Options>
  | TypeAction<InputState, State, Options>
  | UploadAction<InputState, State, Options>;

export type ActionType = Action<{}, {}, {}>["type"];

export type RuntimeValue<
  T extends RawValue,
  InputState extends {},
  State extends InputState,
  Options
> = T | ((context: Context<InputState, State, Options>) => T | Promise<T>);

export type Context<
  InputState extends {},
  State extends InputState,
  Options
> = Readonly<{
  hooks?: FlowHooks<InputState, Options>;
  options: Options;
  frame: Frame;
  state: State;
}>;

export type AssertAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "assert";
  message(context: Context<InputState, State, Options>): Promise<string>;
  check(context: Context<InputState, State, Options>): Promise<boolean>;
  perform: (context: Context<InputState, State, Options>) => Promise<void>;
};

export type ClickAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "click";
  selector(context: Context<InputState, State, Options>): Promise<string>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type ExpectUrlAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "expect_url";
  url(context: Context<InputState, State, Options>): Promise<URL>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type NavigateAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "navigate";
  url(context: Context<InputState, State, Options>): Promise<URL>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type SelectAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "select";
  selector(context: Context<InputState, State, Options>): Promise<string>;
  value(context: Context<InputState, State, Options>): Promise<string>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type SubmitAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "submit";
  selector(context: Context<InputState, State, Options>): Promise<string>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type TypeAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "type";
  selector(context: Context<InputState, State, Options>): Promise<string>;
  value(context: Context<InputState, State, Options>): Promise<string | number>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export type UploadAction<
  InputState extends {},
  State extends InputState,
  Options
> = {
  readonly type: "upload";
  selector(context: Context<InputState, State, Options>): Promise<string>;
  contents(
    context: Context<InputState, State, Options>
  ): Promise<string | Buffer>;
  filename(context: Context<InputState, State, Options>): Promise<string>;
  perform(context: Context<InputState, State, Options>): Promise<void>;
};

export interface FlowHooks<InputState extends {}, Options> {
  /**
   * Hook to allow stopping a flow.
   * Should return `false` or `Promise<false>` to stop the flow.
   */
  beforeAction?: (
    action: ActionType,
    context: Omit<Context<InputState, InputState, Options>, "hooks">
  ) => boolean | void | Promise<boolean | void>;
}

export type FlowResult<InputState, State extends InputState> =
  | {
      completed: true;
      state: State;
    }
  | {
      completed: false;
      state: InputState & Partial<State>;
    };

export interface FlowBuilderInterface<
  InputState extends {},
  State extends InputState,
  Options
> {
  branch<TrueState extends State, FalseState extends State>(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, TrueState, Options>,
    ifFalse: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, FalseState, Options>
  ): FlowBuilderInterface<InputState, TrueState | FalseState, Options>;

  click(selector: string): FlowBuilderInterface<InputState, State, Options>;

  click(
    selector: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  evaluate<NextState extends State>(
    func: (context: Context<InputState, State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  expect(url: string | URL): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<InputState, State, Options>) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<InputState, State, Options>) => Promise<string | URL>
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: string | URL,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<InputState, State, Options>) => string | URL,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (
      context: Context<InputState, State, Options>
    ) => Promise<string | URL>,
    normalizer: (url: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: (
      context: Context<InputState, State, Options>
    ) => Value | Promise<Value>
  ): FlowBuilderInterface<InputState, State & { [key in Key]: Value }, Options>;

  navigateTo(url: string): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(url: URL): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(
    url: RuntimeValue<string | URL, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  run(
    context: Context<InputState, InputState, Options>
  ): Promise<FlowResult<InputState, State>>;

  select(
    selector: string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: string,
    value: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  select(
    selector: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string,
    value: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  submit(): FlowBuilderInterface<InputState, State, Options>;

  submit(selector: string): FlowBuilderInterface<InputState, State, Options>;

  submit(
    selector: (
      context: Context<InputState, State, Options>
    ) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  then<NextState extends State>(
    next: (
      flow: FlowBuilderInterface<InputState, State, Options>
    ) => FlowBuilderInterface<InputState, NextState, Options>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  type(
    selector: string,
    value: string | number
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: string,
    value: (
      context: Context<InputState, State, Options>
    ) => string | number | Promise<string | number>
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (
      context: Context<InputState, State, Options>
    ) => string | Promise<string>,
    value: string | number
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (
      context: Context<InputState, State, Options>
    ) => string | Promise<string>,
    value: (
      context: Context<InputState, State, Options>
    ) => string | number | Promise<string | number>
  ): FlowBuilderInterface<InputState, State, Options>;

  upload(
    selector: RuntimeValue<string, InputState, State, Options>,
    filename: RuntimeValue<string, InputState, State, Options>,
    contents: RuntimeValue<string | Buffer, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  waitUntil(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>
  ): FlowBuilderInterface<InputState, State, Options>;

  when<NextState extends State>(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, NextState, Options>
  ): FlowBuilderInterface<InputState, State | NextState, Options>;
}
