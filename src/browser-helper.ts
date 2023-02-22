import { Browser, launch, Page } from "puppeteer";
import { EventBus } from "./events";

export class BrowserHelper {
  private browserPromise: Promise<Browser> | undefined;
  private readonly events: EventBus;
  private readonly baseURL: URL;

  constructor(events: EventBus, baseURL: URL) {
    this.events = events;
    this.baseURL = baseURL;
  }

  async run(func: (browser: Browser) => Promise<void>): Promise<void> {
    const browser = await this.launchBrowserIfNeeded();
    await func(browser);
  }

  async runInTab(
    tabSelector: (browser: Browser) => Promise<Page>,
    func: (page: Page) => Promise<void>
  ): Promise<void>;
  async runInTab(
    url: string | URL,
    func: (page: Page) => Promise<void>
  ): Promise<void>;
  async runInTab(
    urlOrTabSelector: string | URL | ((browser: Browser) => Promise<Page>),
    func: (page: Page) => Promise<void>
  ): Promise<void> {
    if (typeof urlOrTabSelector !== "function") {
      const url =
        urlOrTabSelector instanceof URL
          ? urlOrTabSelector
          : new URL(urlOrTabSelector, this.baseURL);

      urlOrTabSelector = async (browser: Browser) => {
        const pages = await browser.pages();
        const best = pages.find((page) => {
          return page.url() === url.toString();
        });

        if (best) {
          return best;
        }

        const page = await browser.newPage();
        await page.goto(url.toString());
        return page;
      };
    }

    const tabSelector = urlOrTabSelector;
    const browser = await this.launchBrowserIfNeeded();
    const page = await tabSelector(browser);
    await func(page);
  }

  private launchBrowserIfNeeded(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = launch({
        defaultViewport: null,
        headless: false,
      }).then((browser) => {
        this.events.emit("newBrowser", { browser });
        return browser;
      });
    }

    return this.browserPromise;
  }
}
