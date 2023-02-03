import { FlowRunOptions, FromStateAndOptions } from "./types";

export async function resolveFromStateAndOptions<
  T,
  State,
  Options extends FlowRunOptions
>(
  value: FromStateAndOptions<T, State, Options>,
  state: State,
  options: Options
): Promise<T> {
  if (typeof value === "function") {
    return Promise.resolve(value(state, options));
  }
  return Promise.resolve(value as T);
}
