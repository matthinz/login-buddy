import { AbstractFlowBuilder } from "./base";
import { Action, Context, FlowBuilderInterface } from "./types";

export { FlowBuilderInterface } from "./types";

export class FlowBuilder<
  InputState,
  State extends InputState
> extends AbstractFlowBuilder<InputState, State> {
  private prev: FlowBuilderInterface<InputState, State> | undefined;
  private actions: Action<State>[];

  constructor(
    prev: FlowBuilderInterface<InputState, State> | undefined,
    actions: Action<State>[]
  ) {
    super();
    this.prev = prev;
    this.actions = actions;
  }

  async run(context: Context<InputState>): Promise<State> {
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
    action: Action<State>
  ): FlowBuilderInterface<InputState, State> {
    return new FlowBuilder(this.prev, [...this.actions, action]);
  }
}
