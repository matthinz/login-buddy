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
import {
  Action,
  Context,
  FlowBuilderInterface,
  FlowResult,
  RuntimeValue,
} from "./types";

export abstract class AbstractFlowBuilder<
  InputState,
  State extends InputState,
  Options
> implements FlowBuilderInterface<InputState, State, Options>
{
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
    return this.deriveAndModifyState(
      async (
        context
      ): Promise<FlowResult<InputState, TrueState | FalseState>> => {
        const checkPasses = await check(context);

        const flow = checkPasses
          ? ifTrue(createFlow(), context)
          : ifFalse(createFlow(), context);

        return flow.run(context);
      }
    );
  }

  click(
    selector: RuntimeValue<string, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(click(selector));
  }

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return this.deriveAndModifyState(async (context) => {
      const nextState = await func(context);
      return {
        completed: true,
        state: nextState,
      };
    });
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
      async (context: Context<State, Options>) => {
        const rawValue = generator(context);
        const value = rawValue instanceof Promise ? await rawValue : rawValue;

        const nextState = {
          ...(context.state ?? {}),
          [key]: value,
        } as NextState;

        return {
          completed: true,
          state: nextState,
        };
      }
    );
  }

  navigateTo(
    url: RuntimeValue<string | URL, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(navigate(url));
  }

  abstract run(
    context: Context<InputState, Options>
  ): Promise<FlowResult<InputState, State>>;

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
    converter: (
      context: Context<State, Options>
    ) => Promise<FlowResult<InputState, NextState>>
  ): FlowBuilderInterface<InputState, NextState, Options>;
}
