import { FlowBuilder } from ".";
import { click, navigate, submit, type } from "./actions";
import { ConvertingFlowBuilder } from "./converter";
import { Action, Context, FlowBuilderInterface, RuntimeValue } from "./types";

export abstract class AbstractFlowBuilder<InputState, State extends InputState>
  implements FlowBuilderInterface<InputState, State>
{
  click(
    selector: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State> {
    return this.derive(click(selector));
  }

  evaluate<NextState extends State>(
    func: (context: Context<State>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState> {
    throw new Error();
  }

  navigateTo(
    url: RuntimeValue<string | URL, State>
  ): FlowBuilderInterface<InputState, State> {
    return this.derive(navigate(url));
  }

  abstract run(context: Context<InputState>): Promise<State>;

  submit(
    selector: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State> {
    return this.derive(submit(selector));
  }

  type(
    selector: RuntimeValue<string, State>,
    value: RuntimeValue<string, State>
  ): FlowBuilderInterface<InputState, State> {
    return this.derive(type(selector, value));
  }

  protected derive(
    action: Action<State>
  ): FlowBuilderInterface<InputState, State> {
    return new FlowBuilder(this, [action]);
  }

  protected deriveAndModifyState<NextState extends State>(
    converter: (context: Context<State>) => Promise<NextState>
  ) {
    return new ConvertingFlowBuilder(this, converter);
  }
}
