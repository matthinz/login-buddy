import { AbstractFlowBuilder } from "./base";
import { Context, FlowBuilderInterface } from "./types";

type Converter<From, To, Options> = (
  context: Context<From, Options>
) => Promise<To>;

export class ConvertingFlowBuilder<
  InputState,
  PrevState extends InputState,
  State extends PrevState,
  Options
> extends AbstractFlowBuilder<InputState, State, Options> {
  private prev: FlowBuilderInterface<InputState, PrevState, Options>;
  private converter: Converter<PrevState, State, Options>;

  constructor(
    prev: FlowBuilderInterface<InputState, PrevState, Options>,
    converter: Converter<PrevState, State, Options>
  ) {
    super();
    this.prev = prev;
    this.converter = converter;
  }

  async run(context: Context<InputState, Options>): Promise<State> {
    const prevState = await this.prev.run(context);
    const newContext = {
      ...context,
      state: prevState,
    };
    return await this.converter(newContext);
  }
}
