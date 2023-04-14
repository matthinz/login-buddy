import { Page } from "puppeteer";

export type RawValue = string | number | boolean | object | URL;

export type Action<State, Options> =
  | AssertAction<State, Options>
  | ClickAction<State, Options>
  | SubmitAction<State, Options>
  | ExpectUrlAction<State, Options>
  | NavigateAction<State, Options>
  | TypeAction<State, Options>;

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
  hooks: FlowHooks<State, Options>;
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

export interface FlowHooks<State, Options> {
  [key: string]: <Result>(
    context: Omit<Context<State, Options>, "hooks">
  ) => Promise<Result>;
}

export interface FlowBuilderInterface<
  InputState,
  State extends InputState,
  Options
> {
  click(selector: string): FlowBuilderInterface<InputState, State, Options>;

  click(
    selector: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  expect(url: string | URL): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => string
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => URL
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => Promise<string>
  ): FlowBuilderInterface<InputState, State, Options>;

  expect(
    url: (context: Context<State, Options>) => Promise<URL>
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

  run(context: Context<InputState, Options>): Promise<State>;

  submit(selector: string): FlowBuilderInterface<InputState, State, Options>;

  submit(
    selector: (context: Context<State, Options>) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

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
}
