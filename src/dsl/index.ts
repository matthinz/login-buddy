import { FlowBuilder, FlowBuilderInterface } from "./flow-builder";

export { Context, FlowBuilderInterface } from "./flow-builder";

export * from "./utils";

export function createFlow<State, Options>(): FlowBuilderInterface<
  State,
  State,
  Options
> {
  return new FlowBuilder<State, State, Options>(undefined, []);
}
