import { Flow } from "./flow";
import { FlowInterface, FlowRunOptions } from "./types";

export { FlowInterface, FlowRunOptions } from "./types";

export function createFlow<InputState extends {}, Options>(): FlowInterface<
  InputState,
  InputState,
  Options & FlowRunOptions
> {
  return new Flow<InputState, InputState, Options & FlowRunOptions>(
    (prevState) => Promise.resolve({ state: prevState, isPartial: false })
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

export function until<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
>(
  expr: string | RegExp
): (state: InputState, options: Options) => boolean | Promise<boolean> {
  return async (_state, { page }) => {
    if (!page) {
      return false;
    }

    const url = page.url();

    if (expr instanceof RegExp) {
      if (expr.test(url)) {
        console.error("Page url matches %s. Stopping.", expr);
        return true;
      }
      return false;
    }

    if (url.includes(expr)) {
      console.error("Page url includes '%s'. Stopping.", expr);
      return true;
    }

    const title = await page.title();
    if (title.includes(expr)) {
      console.error("Page title includes '%s'. Stopping.", expr);
      return true;
    }

    return false;
  };
}
