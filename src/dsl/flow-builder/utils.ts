import { Context } from "./types";

/**
 * @returns A function that plucks a value out of a Context's `state`.
 */
export function pickFromState<
  State extends {},
  Options,
  Key extends keyof State
>(key: Key): (context: Context<State, Options>) => State[Key] {
  return ({ state }: Context<State, Options>) => {
    return state[key];
  };
}
