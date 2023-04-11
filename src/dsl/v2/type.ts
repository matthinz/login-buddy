import { Page } from "puppeteer";

export type Action<State> =
  | ClickAction<State>
  | SubmitAction<State>
  | ExpectUrlAction<State>
  | EvaluateAction<State>
  | TypeAction<State>;

export type RawValue = string | number | boolean | object | URL;

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
