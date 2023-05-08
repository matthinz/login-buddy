import { FlowBuilder } from ".";
import { AbstractFlowBuilder } from "./base";
import {
  Action,
  Context,
  FlowBuilderInterface,
  FlowHooks,
  FlowResult,
} from "./types";

export class ConvertingFlowBuilder<
  InputState,
  PrevState extends InputState,
  State extends PrevState,
  Options
> extends AbstractFlowBuilder<InputState, State, Options> {
  private prev: FlowBuilderInterface<InputState, PrevState, Options>;
  private converter: (
    context: Context<InputState, PrevState, Options>
  ) => Promise<FlowResult<InputState, State>>;

  constructor(
    prev: FlowBuilderInterface<InputState, PrevState, Options>,
    converter: (
      context: Context<InputState, PrevState, Options>
    ) => Promise<FlowResult<InputState, State>>
  ) {
    super();
    this.prev = prev;
    this.converter = converter;
  }

  async run(
    context: Context<InputState, InputState, Options>
  ): Promise<FlowResult<InputState, State>> {
    const prevResult = await this.prev.run(context);

    if (!prevResult.completed) {
      return prevResult;
    }

    const contextToConvert: Context<InputState, PrevState, Options> = {
      ...context,
      state: prevResult.state,
    };

    return await this.converter(contextToConvert);
  }

  protected override derive(
    action: Action<InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return new FlowBuilder(this, [action]);
  }

  protected override deriveAndModifyState<NextState extends State>(
    converter: (
      context: Context<InputState, State, Options>
    ) => Promise<FlowResult<InputState, NextState>>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return new ConvertingFlowBuilder(this, converter);
  }
}
