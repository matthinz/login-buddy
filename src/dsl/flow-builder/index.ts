import { AbstractFlowBuilder } from "./base";
import { Action, Context, FlowBuilderInterface, FlowResult } from "./types";
import { ConvertingFlowBuilder } from "./converter";

export { Context, FlowBuilderInterface } from "./types";

export class FlowBuilder<
  InputState,
  State extends InputState,
  Options
> extends AbstractFlowBuilder<InputState, State, Options> {
  private prev: FlowBuilderInterface<InputState, State, Options> | undefined;
  private actions: Action<State, Options>[];

  constructor(
    prev: FlowBuilderInterface<InputState, State, Options> | undefined,
    actions: Action<State, Options>[]
  ) {
    super();
    this.prev = prev;
    this.actions = actions;
  }

  async run(
    context: Context<InputState, Options>
  ): Promise<FlowResult<InputState, State>> {
    let prevState: State;

    if (this.prev) {
      const prevResult = await this.prev.run(context);
      if (!prevResult.completed) {
        return prevResult;
      }
      prevState = prevResult.state;
    } else {
      prevState = context.state as State;
    }

    const newContext = {
      ...context,
      hooks: undefined,
      state: prevState,
    };

    const finalContext = await this.actions.reduce(
      (promise, action) =>
        promise.then(async (context) => {
          await action.perform(context);
          return context;
        }),
      Promise.resolve(newContext)
    );

    return {
      completed: true,
      state: finalContext.state,
    };
  }

  protected override derive(
    action: Action<State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return new FlowBuilder(this.prev, [...this.actions, action]);
  }

  protected override deriveAndModifyState<NextState extends State>(
    converter: (
      context: Context<State, Options>
    ) => Promise<FlowResult<InputState, NextState>>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return new ConvertingFlowBuilder(this, converter);
  }
}
