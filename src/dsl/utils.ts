import { Context } from "./flow-builder";
import { FlowHooks } from "./flow-builder/types";

/**
 * Helper for use with .branch() or .when() to limit to a certain path.
 */
export function atPath<InputState, State extends InputState, Options>(
  path: string
): (context: Context<InputState, State, Options>) => boolean {
  return ({ page }: Context<InputState, State, Options>) => {
    const url = new URL(page.url());
    return url.pathname === path;
  };
}

/**
 * Helper for use with .branch() or .when() used to check whether a selector
 * is present on the current page.
 */
export function selectorFound<InputState, State extends InputState, Options>(
  selector: string
): (context: Context<InputState, State, Options>) => Promise<boolean> {
  return async ({ page }) => {
    return !!(await page.$(selector));
  };
}

/**
 * Helper that generates a `hooks` value that will stop a flow once it's
 * reached a URL with `value` in the pathname.
 * @param value
 * @returns
 */
export function untilPathIncludes<State, Options>(
  value: string | void
): FlowHooks<State, Options> {
  return {
    beforeAction(action, context) {
      if (value == null) {
        return;
      }

      const { pathname } = new URL(context.page.url());
      if (pathname.includes(value)) {
        return false;
      }
    },
  };
}
