import { GlobalState } from "./types";

export function createState(initialState: GlobalState): {
  update(newState: GlobalState): void;
  current(): GlobalState;
} {
  let state = initialState;

  function update(newState: GlobalState) {
    state = { ...newState };
  }
  function current() {
    return state;
  }

  return { update, current };
}
