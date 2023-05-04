import { Context } from "./flow-builder";

/**
 * Helper for use with .branch() or .when() to limit to a certain path.
 */
export function atPath<State, Options>(
  path: string
): ({ page }: Context<State, Options>) => boolean {
  return ({ page }: Context<State, Options>) => {
    const url = new URL(page.url());
    return url.pathname === path;
  };
}
