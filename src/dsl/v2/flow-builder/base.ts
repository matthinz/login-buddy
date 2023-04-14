import { FlowBuilder } from ".";
import { FlowHooks } from "../../types";
import { click, navigate, submit, type } from "./actions";
import { ConvertingFlowBuilder } from "./converter";
import { Action, Context, FlowBuilderInterface, RuntimeValue } from "./types";

export abstract class AbstractFlowBuilder<
  InputState,
  State extends InputState,
  Options
> implements FlowBuilderInterface<InputState, State, Options>
{
  click(
    selector: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(click(selector));
  }

  evaluate<NextState extends State>(
    func: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    throw new Error();
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
    url: RuntimeValue<string | URL, State>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(navigate(url));
  }

  abstract run(context: Context<InputState, Options>): Promise<State>;

  submit(
    selector: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(submit(selector));
  }

  type(
    selector: RuntimeValue<string, State>,
    value: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(type(selector, value));
  }

  protected derive(
    action: Action<State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return new FlowBuilder(this, [action]);
  }

  protected deriveAndModifyState<NextState extends State>(
    converter: (context: Context<State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return new ConvertingFlowBuilder(this, converter);
  }
}
