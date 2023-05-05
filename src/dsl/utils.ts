import { Context } from "./flow-builder";

/**
 * Helper for use with .branch() or .when() to limit to a certain path.
 */
export function atPath<State, Options>(
  path: string
): (context: Context<State, Options>) => boolean {
  return ({ page }: Context<State, Options>) => {
    const url = new URL(page.url());
    return url.pathname === path;
  };
}

/**
 * Helper for use with .branch() or .when() used to check whether a selector
 * is present on the current page.
 */
export function selectorFound<State, Options>(
  selector: string
): (context: Context<State, Options>) => Promise<boolean> {
  return async ({ page }) => {
    return !!(await page.$(selector));
  };
}
