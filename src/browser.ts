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
