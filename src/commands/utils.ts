import { Browser, launch, Page } from "puppeteer";
import { CommandExecution } from "./types";

type StateWithBaseUrlInProgramOptions = {
  programOptions: {
    baseURL: URL;
  };
};

export function runFromBrowser<Params, State extends {}>(
  func: (browser: Browser, params: Params, state: State) => Promise<State>
): (params: Params, state: State) => CommandExecution<State> {
  return makeRunner(async (params: Params, state: State) => {
    const newState = await ensureBrowserLaunched(state);
    const { browser } = newState;
    return await func(browser, params, newState);
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
  Params,
  State extends StateWithBaseUrlInProgramOptions
>(
  url: string | URL,
  func: (page: Page, params: Params, state: State) => Promise<State>
): (params: Params, state: State) => CommandExecution<State> {
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

export function runFromPageFancy<Params, State extends {}>(
  shouldUsePage:
    | (((page: Page, state: State) => Promise<boolean>) | string)
    | (((page: Page, state: State) => Promise<boolean>) | string)[],
  createPage: (browser: Browser, state: State) => Promise<Page>,
  func: (page: Page, params: Params, state: State) => Promise<State>
): (params: Params, state: State) => CommandExecution<State> {
  return runFromBrowser(
    async (browser: Browser, params: Params, state: State): Promise<State> => {
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

      return await func(page, params, state);
    }
  );
}

export function makeRunner<Params, State>(
  func: (params: Params, state: State) => Promise<State>
): (params: Params, state: State) => CommandExecution<State> {
  return function run(params: Params, state: State): CommandExecution<State> {
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

    func(params, state).then(
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
