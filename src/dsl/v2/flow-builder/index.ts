import { AbstractFlowBuilder } from "./base";
import { Action, Context, FlowBuilderInterface } from "./types";

export { FlowBuilderInterface } from "./types";

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

  async run(context: Context<InputState, Options>): Promise<State> {
    const state = this.prev
      ? await this.prev.run(context)
      : (context.state as State);

    const newContext = {
      ...context,
      state,
    };

    const { state: result } = await this.actions.reduce(
      (promise, action) =>
        promise.then(async (context) => {
          await action.perform(context);
          return context;
        }),
      Promise.resolve(newContext)
    );

    return result;
  }

  protected override derive(
    action: Action<State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return new FlowBuilder(this.prev, [...this.actions, action]);
  }
}
