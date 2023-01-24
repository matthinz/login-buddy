import { launch } from "puppeteer";
import { GlobalState } from "./types";

export async function ensureBrowserLaunched(
  globalState: GlobalState
): Promise<GlobalState> {
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
