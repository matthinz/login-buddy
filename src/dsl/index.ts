import { Flow } from "./flow";
import { FlowInterface, FlowRunOptions, Stopper } from "./types";

export function createFlow<InputState, Options>(): FlowInterface<
  InputState,
  InputState,
  Options & FlowRunOptions
> {
  return new Flow<InputState, InputState, Options & FlowRunOptions>(
    (prevState) => Promise.resolve(prevState),
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
>(expr: string): Stopper<InputState, OutputState, Options> {
  return async (_state, options) => {
    const page = options.page;
    if (!page) {
      return false;
    }

    const url = page.url();
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
