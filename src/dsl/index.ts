import { Flow } from "./flow";
import { FlowInterface, FlowRunOptions } from "./types";

export function createFlow<InputState, Options>(): FlowInterface<
  InputState,
  InputState,
  Options & FlowRunOptions
> {
  return new Flow<InputState, InputState, Options & FlowRunOptions>(
    (prevState) => Promise.resolve(prevState)
  );
}

/**
 * Starts a new flow, without any custom options.
 * @param url
 */
export function navigateTo(
  url: string | URL
): FlowInterface<{}, {}, FlowRunOptions> {
  return createFlow<{}, {}>().navigateTo(url);
}
