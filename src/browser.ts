import { Browser, launch, Page } from "puppeteer";
import { GlobalState } from "./types";

export async function ensureBrowserLaunched(
  globalState: GlobalState
): Promise<GlobalState & { browser: Browser }> {
  let { browser } = globalState;

  if (!browser) {
    browser = await launch({
      headless: false,
      defaultViewport: null,
    });
  }

  return {
    ...globalState,
    browser,
  };
}

export async function ensureCurrentPage(
  globalState: GlobalState
): Promise<GlobalState & { browser: Browser; page: Page }> {
  let result = await ensureBrowserLaunched(globalState);
  let { page, browser } = result;
  if (!page || page.isClosed()) {
    page = await browser.newPage();
  }

  return {
    ...globalState,
    browser,
    page,
  };
}

/**
 * Tries to find an active tab in the browser for the given URL.
 */
export async function getPageForUrl(
  urlOrChecker: string | URL,
  globalState: GlobalState
): Promise<Page | void> {
  const { browser } = globalState;
  if (!browser) {
    return;
  }

  const pages = await browser.pages();

  const checker = (page: Page): boolean => {
    if (typeof urlOrChecker === "string") {
      urlOrChecker = new URL(urlOrChecker, globalState.programOptions.baseURL);
    }

    if (urlOrChecker instanceof URL) {
      return page.url() === urlOrChecker.toString();
    }

    return false;
  };

  let promise = Promise.resolve<Page | undefined>(undefined);

  pages.forEach((page) => {
    promise = promise.then(async (result: Page | undefined) => {
      if (result) {
        return result;
      }

      if (checker(page)) {
        return page;
      }
    });
  });

  return await promise;
}
