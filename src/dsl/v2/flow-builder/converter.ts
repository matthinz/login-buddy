import { AbstractFlowBuilder } from "./base";
import { Context, FlowBuilderInterface } from "./types";

type Converter<From, To> = (context: Context<From>) => Promise<To>;

export class ConvertingFlowBuilder<
  InputState,
  PrevState extends InputState,
  State extends PrevState
> extends AbstractFlowBuilder<InputState, State> {
  private prev: FlowBuilderInterface<InputState, PrevState>;
  private converter: Converter<PrevState, State>;

  constructor(
    prev: FlowBuilderInterface<InputState, PrevState>,
    converter: Converter<PrevState, State>
  ) {
    super();
    this.prev = prev;
    this.converter = converter;
  }

  async run(context: Context<InputState>): Promise<State> {
    const prevState = await this.prev.run(context);
    const newContext = {
      ...context,
      state: prevState,
    };
    return await this.converter(newContext);
  }
}
