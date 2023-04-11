import { Runtime } from "node:inspector";
import { Page } from "puppeteer";

export type RawValue = string | number | boolean | object | URL;

export type Action<State> =
  | ClickAction<State>
  | SubmitAction<State>
  | ExpectUrlAction<State>
  | EvaluateAction<State>
  | NavigateAction<State>
  | TypeAction<State>;

export type RuntimeValue<T extends RawValue, State> =
  | T
  | ((state: State) => T | Promise<T>);

export type Context<State> = {
  page: Page;
  state: State;
};

export type ClickAction<State> = {
  readonly type: "click";
  selector(state: State): Promise<string>;
  perform(context: Context<State>): Promise<void>;
};

export type NavigateAction<State> = {
  readonly type: "navigate";
  url(state: State): Promise<URL>;
  perform(context: Context<State>): Promise<void>;
};

export type SubmitAction<State> = {
  readonly type: "submit";
  selector(state: State): Promise<string>;
  perform: (context: Context<State>) => Promise<void>;
};

export type ExpectUrlAction<State> = {
  readonly type: "expect_url";
  url(state: State): Promise<URL>;
  perform: (context: Context<State>) => Promise<void>;
};

export type EvaluateAction<State> = {
  readonly type: "evaluate";
  func: (context: Context<State>) => Promise<void>;
  perform(context: Context<State>): Promise<void>;
};

export type TypeAction<State> = {
  readonly type: "type";
  selector(state: State): Promise<string>;
  value(state: State): Promise<string>;
  perform(context: Context<State>): Promise<void>;
};

export interface FlowBuilderInterface<InputState, State extends InputState> {
  click(selector: string): FlowBuilderInterface<InputState, State>;

  click(
    selector: (state: State) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State>;

  evaluate<NextState extends State>(
    func: (context: Context<State>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState>;

  navigateTo(url: string): FlowBuilderInterface<InputState, State>;

  navigateTo(url: URL): FlowBuilderInterface<InputState, State>;

  navigateTo(
    url: RuntimeValue<string | URL, State>
  ): FlowBuilderInterface<InputState, State>;

  run(context: Context<InputState>): Promise<State>;

  submit(selector: string): FlowBuilderInterface<InputState, State>;

  submit(
    selector: (state: State) => Promise<string> | string
  ): FlowBuilderInterface<InputState, State>;

  type(
    selector: string,
    value: string
  ): FlowBuilderInterface<InputState, State>;

  type(
    selector: string,
    value: (state: State) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State>;

  type(
    selector: (state: State) => string | Promise<string>,
    value: string
  ): FlowBuilderInterface<InputState, State>;

  type(
    selector: (state: State) => string | Promise<string>,
    value: (state: State) => string | Promise<string>
  ): FlowBuilderInterface<InputState, State>;
}
