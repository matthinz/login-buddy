import { AbstractFlowBuilder } from "./base";
import { Action, Context, FlowBuilderInterface, FlowResult } from "./types";
import { ConvertingFlowBuilder } from "./converter";

export { Context, FlowBuilderInterface } from "./types";

export class FlowBuilder<
  InputState extends {},
  State extends InputState,
  Options
> extends AbstractFlowBuilder<InputState, State, Options> {
  private prev: FlowBuilderInterface<InputState, State, Options> | undefined;
  private actions: Action<InputState, State, Options>[];

  constructor(
    prev: FlowBuilderInterface<InputState, State, Options> | undefined,
    actions: Action<InputState, State, Options>[]
  ) {
    super();
    this.prev = prev;
    this.actions = actions;
  }

  async run(
    context: Context<InputState, InputState, Options>
  ): Promise<FlowResult<InputState, State>> {
    let state: State;

    if (this.prev) {
      const prevResult = await this.prev.run(context);
      if (!prevResult.completed) {
        return prevResult;
      }
      state = prevResult.state;
    } else {
      state = context.state as State;
    }

    const finalContext: Context<InputState, State, Options> = {
      ...context,
      state,
    };

    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];

      if (finalContext.hooks?.beforeAction) {
        const ok = await finalContext.hooks.beforeAction(
          action.type,
          finalContext
        );

        if (ok === false) {
          return {
            completed: false,
            state: finalContext.state,
          };
        }
      }

      await action.perform(finalContext);
    }

    return {
      completed: true,
      state: finalContext.state,
    };
  }

  protected override derive(
    action: Action<InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return new FlowBuilder(this.prev, [...this.actions, action]);
  }

  protected override deriveAndModifyState<NextState extends State>(
    converter: (
      context: Context<InputState, State, Options>
    ) => Promise<FlowResult<InputState, NextState>>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return new ConvertingFlowBuilder(this, converter);
  }
}
