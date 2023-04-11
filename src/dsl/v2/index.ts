import { FlowBuilder, FlowBuilderInterface } from "./flow-builder";

export function createFlow<State>(): FlowBuilderInterface<State, State> {
  return new FlowBuilder<State, State>(undefined, []);
}

export function navigateTo<State>(
  url: string | URL
): FlowBuilderInterface<State, State> {
  return createFlow<State>().navigateTo(url);
}
