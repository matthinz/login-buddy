import { Context } from "./flow-builder";
import { FlowHooks } from "./flow-builder/types";

/**
 * Helper for use with .branch() or .when() to limit to a certain path.
 */
export function atPath<
  InputState extends {},
  State extends InputState,
  Options
>(path: string): (context: Context<InputState, State, Options>) => boolean {
  return ({ frame }: Context<InputState, State, Options>) => {
    const url = new URL(frame.url());
    return url.pathname === path;
  };
}

export function notAtPath<
  InputState extends {},
  State extends InputState,
  Options
>(path: string): (context: Context<InputState, State, Options>) => boolean {
  return ({ frame }: Context<InputState, State, Options>) => {
    const url = new URL(frame.url());
    return url.pathname !== path;
  };
}

/**
 * Helper for use with .branch() or .when() used to check whether a selector
 * is present on the current page.
 */
export function selectorFound<
  InputState extends {},
  State extends InputState,
  Options
>(
  selector: string
): (context: Context<InputState, State, Options>) => Promise<boolean> {
  return async ({ frame }) => {
    return !!(await frame.$(selector));
  };
}

/**
 * Helper that generates a `hooks` value that will stop a flow once it's
 * reached a URL with `value` in the pathname.
 * @param value
 * @returns
 */
export function untilPathIncludes<State extends {}, Options>(
  value: string | void
): FlowHooks<State, Options> {
  return {
    beforeAction(action, context) {
      if (value == null) {
        return;
      }

      const { pathname } = new URL(context.frame.url());
      if (pathname.includes(value)) {
        return false;
      }
    },
  };
}
