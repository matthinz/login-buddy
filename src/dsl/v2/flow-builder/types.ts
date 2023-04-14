import { Page } from "puppeteer";

export type RawValue = string | number | boolean | object | URL;

export type Action<State, Options> =
  | ClickAction<State, Options>
  | SubmitAction<State, Options>
  | ExpectUrlAction<State, Options>
  | EvaluateAction<State, Options>
  | NavigateAction<State, Options>
  | TypeAction<State, Options>;

export type RuntimeValue<T extends RawValue, State> =
  | T
  | ((state: State) => T | Promise<T>);

export type Context<State, Options> = {
  hooks: FlowHooks<State, Options>;
  options: Options;
  page: Page;
  state: State;
};

export type ClickAction<State, Options> = {
  readonly type: "click";
  selector(state: State): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type NavigateAction<State, Options> = {
  readonly type: "navigate";
  url(state: State): Promise<URL>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type SubmitAction<State, Options> = {
  readonly type: "submit";
  selector(state: State): Promise<string>;
  perform: (context: Context<State, Options>) => Promise<void>;
};

export type ExpectUrlAction<State, Options> = {
  readonly type: "expect_url";
  url(state: State): Promise<URL>;
  perform: (context: Context<State, Options>) => Promise<void>;
};

export type EvaluateAction<State, Options> = {
  readonly type: "evaluate";
  func: (context: Context<State, Options>) => Promise<void>;
  perform(context: Context<State, Options>): Promise<void>;
};

export type TypeAction<State, Options> = {
  readonly type: "type";
  selector(state: State): Promise<string>;
  value(state: State): Promise<string>;
  perform(context: Context<State, Options>): Promise<void>;
};

export interface FlowHooks<State, Options> {
  [key: string]: <Result>(
    context: Omit<Context<State, Options>, "hooks">
  ) => Promise<Result>;
}

type BranchCheck<State, Options> = (
  context: Context<State, Options>
) => boolean | Promise<boolean> | void | Promise<void>;

export interface FlowBuilderInterface<
  InputState,
  State extends InputState,
  Options
> {
  click(selector: string): FlowBuilderInterface<InputState, State, Options>;

  click(
    selector: (state: State) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options>;

  generate<Key extends string, Value>(
    key: Key,
    generator: (context: Context<State, Options>) => Value | Promise<Value>
  ): FlowBuilderInterface<InputState, State & { [key in Key]: Value }, Options>;

  navigateTo(url: string): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(url: URL): FlowBuilderInterface<InputState, State, Options>;

  navigateTo(
    url: RuntimeValue<string | URL, State>
  ): FlowBuilderInterface<InputState, State, Options>;

  run(context: Context<InputState, Options>): Promise<State>;

  submit(selector: string): FlowBuilderInterface<InputState, State, Options>;

  submit(
    selector: (state: State) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: string,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: string,
    value: (state: State) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (state: State) => string | Promise<string>,
    value: string
  ): FlowBuilderInterface<InputState, State, Options>;

  type(
    selector: (state: State) => string | Promise<string>,
    value: (state: State) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State, Options>;
}
