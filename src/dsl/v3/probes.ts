import { FluentProbeBuilder, NuggetProbe } from "./types";


export function at<T>(
  url: string | URL,
  next?: NuggetProbe<T>
): FluentProbeBuilder<T>
  return async (context) => {
    const currentURL = await context.page.url();
    const checkURL = typeof url === "string" ? new URL(url, currentURL) : url;

    if (currentURL.toString() !== checkURL.toString()) {
      return;
    }

    if (next) {
      await next(context);
    }
  };
}

export function selectorFound<T>(
  selector: string,
  next?: NuggetProbe<T>
): NuggetProbe<T> {
  return async (context) => {
    const exists = await context.page.selectorExists(selector);
    if (exists && next) {
      return await next(context);
    }
  };
}

export function stateIncludes<T, TKey extends string>(
  key: TKey,
  next?: NuggetProbe<T & { [key in TKey]: unknown }>
): NuggetProbe<T> {
  return async (context) => {
    const { state } = context;
    if (typeof state !== "object" || !state) {
      return;
    }

    if (!(key in state)) {
      return;
    }

    if (!next) {
      return;
    }

    return await next({
      ...context,
      state: state as T & { [key in TKey]: unknown },
    });
  };
}
