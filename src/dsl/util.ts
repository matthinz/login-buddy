import { FromState } from "./types";

export async function resolveFromState<T, State>(
  value: FromState<T, State>,
  state: State
): Promise<T> {
  if (typeof value === "function") {
    return Promise.resolve(value(state));
  }
  return Promise.resolve(value as T);
}
