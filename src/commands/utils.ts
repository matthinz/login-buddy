import { Browser, launch, Page } from "puppeteer";
import { CommandExecution, CommandHooks } from "./types";

type StateWithBaseUrlInProgramOptions = {
  programOptions: {
    baseURL: URL;
  };
};

type RunFunction<State extends {}, Options extends {}> = (
  state: State,
  options: Options,
  hooks: CommandHooks<State>
) => CommandExecution<State>;

/**
 * Creates a run() function that discovers the active page in the browser
 * and passes it in.
 */
export function runFromActivePage<State extends {}, Options extends {}>(
  func: (
    page: Page,
    state: State,
    options: Options,
    hooks: CommandHooks<State>
  ) => Promise<State>
): RunFunction<State, Options> {
  return runFromBrowser(async (browser, state, options, hooks) => {
    const pages = await browser.pages();
    const page = await pages.reduce<Promise<Page | undefined>>(
      (promise, page) => {
        return promise.then(async (result) => {
          if (result) {
            return result;
          }

          const isVisible = await page.evaluate(
            () => document.visibilityState === "visible"
          );

          if (isVisible) {
            return page;
          }
        });
      },
      Promise.resolve(undefined)
    );

    if (!page) {
      throw new Error("No current page.");
    }

    return func(page, state, options, hooks);
  });
}

/**
 * Creates a run() function that manages tracking a browser instance
 * in the global state.
 */
export function runFromBrowser<State extends {}, Options extends {}>(
  func: (
    browser: Browser,
    state: State,
    options: Options,
    hooks: CommandHooks<State>
  ) => Promise<State>
): RunFunction<State, Options> {
  return makeRunner(async (state, options, hooks) => {
    const newState = await ensureBrowserLaunched(state);
    hooks.updateState(newState); // Ensure we save the browser we launched

    const { browser } = newState;
    return await func(browser, newState, options, hooks);
  });
}

/**
 * Creates a command runner that starts with a browser open to a page
 * that passes the given check. If a page is already open, it will be reused.
 * Otherwise a new page will be opened at the given URL.
 * @param pageChecker
 * @param func
 */
export function runFromPage<
  State extends StateWithBaseUrlInProgramOptions,
  Options extends {}
>(
  url: string | URL,
  func: (
    page: Page,
    state: State,
    options: Options,
    hooks: CommandHooks<State>
  ) => Promise<State>
): RunFunction<State, Options> {
  async function shouldUsePage(page: Page): Promise<boolean> {
    return pageMatches(url, page);
  }

  async function createPage(
    browser: Browser,
    { programOptions: { baseURL } }: State
  ): Promise<Page> {
    const page = await browser.newPage();
    await page.goto(new URL(url, baseURL).toString());
    return page;
  }

  return runFromPageFancy(shouldUsePage, createPage, func);
}

export function runFromPageFancy<State extends {}, Options extends {}>(
  shouldUsePage:
    | (((page: Page, state: State) => Promise<boolean>) | string)
    | (((page: Page, state: State) => Promise<boolean>) | string)[],
  createPage: (browser: Browser, state: State) => Promise<Page>,
  func: (
    page: Page,
    state: State,
    options: Options,
    hooks: CommandHooks<State>
  ) => Promise<State>
): RunFunction<State, Options> {
  return runFromBrowser(
    async (
      browser: Browser,
      state: State,
      options: Options,
      hooks: CommandHooks<State>
    ): Promise<State> => {
      shouldUsePage = Array.isArray(shouldUsePage)
        ? shouldUsePage
        : [shouldUsePage];

      // Find the best page in the browser to re-use
      let promise = Promise.resolve<Page | undefined>(undefined);
      const pages = await browser.pages();

      shouldUsePage.forEach((shouldUse) => {
        const test = async (page: Page, state: State): Promise<boolean> => {
          if (typeof shouldUse === "string") {
            return pageMatches(shouldUse, page);
          }
          return shouldUse(page, state);
        };

        pages.forEach((page) => {
          promise = promise.then(async (result) => {
            if (result) {
              return result;
            }
            if (await test(page, state)) {
              return page;
            }
          });
        });
      });

      const page = (await promise) ?? (await createPage(browser, state));

      return await func(page, state, options, hooks);
    }
  );
}

/**
 * Creates an appropriate run() function for a command.
 */
export function makeRunner<State extends {}, Options extends {}>(
  func: (
    state: State,
    options: Options,
    hooks: CommandHooks<State>
  ) => Promise<State>
): RunFunction<State, Options> {
  return function run(state, options, hooks): CommandExecution<State> {
    let resolve: (state: State) => void;
    let reject: (err: Error) => void;
    let didAbort = false;

    const promise = new Promise<State>((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    const abort = () => {
      didAbort = true;
      reject(new Error("Aborted"));
    };

    func(state, options, hooks).then(
      (newState) => {
        resolve(newState ?? state);
      },
      (err) => {
        reject(err);
      }
    );

    return {
      promise,
      abort,
    };
  };
}

async function ensureBrowserLaunched<State extends {}>(
  state: State
): Promise<State & { browser: Browser }> {
  let { browser } = state as Record<string, any>;

  browser = browser
    ? (browser as Browser)
    : await launch({
        headless: false,
        defaultViewport: null,
      });

  return {
    ...state,
    browser,
  };
}

function pageMatches(expr: string | URL, page: Page): boolean {
  const pageUrl = new URL(page.url());

  if (typeof expr === "string") {
    if (expr.startsWith("/")) {
      // Check the path of the page's current url
      return pageUrl.pathname === expr;
    }
    return pageUrl.toString().includes(expr);
  }

  return pageUrl.toString() === expr.toString();
}
