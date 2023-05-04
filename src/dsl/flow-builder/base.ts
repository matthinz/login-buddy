import { createFlow } from "..";
import {
  click,
  expectUrl,
  navigate,
  select,
  submit,
  type,
  upload,
} from "./actions";
import { Action, Context, FlowBuilderInterface, RuntimeValue } from "./types";

export abstract class AbstractFlowBuilder<
  InputState,
  State extends InputState,
  Options
> implements FlowBuilderInterface<InputState, State, Options>
{
  askIfNeeded<Key extends string>(
    key: Key,
    prompt: string,
    normalizer?: (input: string) => string | Promise<string>
  ): FlowBuilderInterface<
    InputState,
    State & { [key in Key]: string },
    Options
  > {
    return this.deriveAndModifyState(async (context) => {
      const { state, hooks } = context;

      if (typeof state !== "object") {
        throw new Error();
      }

      if (state == null) {
        throw new Error();
      }

      let value = await hooks.ask(prompt);

      if (typeof value !== "string") {
        throw new Error();
      }

      if (normalizer) {
        value = await normalizer(value);
      }

      return {
        ...state,
        [key]: value,
      } as State & { [key in Key]: string };
    });
  }

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
  ): FlowBuilderInterface<InputState, TrueState | FalseState, Options> {
    return this.deriveAndModifyState(async (context) => {
      const checkPasses = await check(context);

      const flow = checkPasses
        ? ifTrue(createFlow(), context)
        : ifFalse(createFlow(), context);

      return await flow.run(context);
    });
  }

  click(
    selector: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(click(selector));
  }

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return this.deriveAndModifyState(func);
  }

  expect(
    url: RuntimeValue<string | URL, State, Options>,
    normalizer?: (input: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(expectUrl(url, normalizer));
  }

  generate<
    Key extends string,
    Value,
    NextState extends State & { [key in Key]: Value }
  >(
    key: Key,
    generator: (context: Context<State, Options>) => Value | Promise<Value>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return this.deriveAndModifyState(
      async (context: Context<State, Options>): Promise<NextState> => {
        const rawValue = generator(context);
        const value = rawValue instanceof Promise ? await rawValue : rawValue;

        return {
          ...(context.state ?? {}),
          [key]: value,
        } as NextState;
      }
    );
  }

  navigateTo(
    url: RuntimeValue<string | URL, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(navigate(url));
  }

  abstract run(context: Context<InputState, Options>): Promise<State>;

  select(
    selector: RuntimeValue<string, State, Options>,
    value: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(select(selector, value));
  }

  submit(
    selector?: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(submit(selector ?? "form button[type=submit]"));
  }

  then<NextState extends State>(
    next: (
      flow: FlowBuilderInterface<InputState, State, Options>
    ) => FlowBuilderInterface<InputState, NextState, Options>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return next(this);
  }

  type(
    selector: RuntimeValue<string, State, Options>,
    value: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(type(selector, value));
  }

  upload(
    selector: RuntimeValue<string, State, Options>,
    filename: RuntimeValue<string, State, Options>,
    contents: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(upload(selector, filename, contents));
  }

  when<NextState extends State>(
    check: (
      context: Context<State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<State, Options>
    ) => FlowBuilderInterface<State, NextState, Options>
  ): FlowBuilderInterface<InputState, State | NextState, Options> {
    return this.branch(check, ifTrue, (flow) => flow);
  }

  protected abstract derive(
    action: Action<State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  protected abstract deriveAndModifyState<NextState extends State>(
    converter: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options>;
}
