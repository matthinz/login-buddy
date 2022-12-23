import { launch, Browser, Page } from "puppeteer";
import { Flow } from "./flow";
import { FlowInterface, FlowRunOptions, FromState } from "./types";

export function createFlow<Options extends FlowRunOptions>(
  options?: Partial<Options>
): FlowInterface<{}, Options> {
  let { page, browser } = options ?? {};

  if (!browser) {
    let _browser: Browser | undefined;
    browser = async () => {
      _browser =
        _browser ??
        (await launch({
          defaultViewport: null,
          headless: false,
        }));
      return _browser;
    };
  }

  if (!page) {
    let _page: Page | undefined;
    page = async () => {
      if (_page && !_page.isClosed()) {
        return _page;
      }
      if (!browser) {
        throw new Error("lost browser");
      }
      const b = await browser();
      _page = await b.newPage();
      return _page;
    };
  }

  const actualOptions: FlowRunOptions = {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    browser,
    page,
  };

  return new Flow(() => Promise.resolve({}), actualOptions);
}

/**
 * Starts a new flow, without any custom options.
 * @param url
 */
export function navigateTo(
  url: string | URL
): FlowInterface<{}, FlowRunOptions> {
  return createFlow().navigateTo(url);
}
