import { Browser, Page } from "puppeteer";

export class BrowserHelper {
  private readonly _launch: () => Promise<Browser>;
  private browser: Browser | undefined;

  constructor(launch: () => Promise<Browser>) {
    this._launch = () =>
      launch().then((browser) => {
        this.browser = browser;
        return browser;
      });
  }

  async activePage(): Promise<Page | undefined> {
    if (!this.browser) {
      return;
    }

    return await scanPages(this.browser);

    async function scanPages(browser: Browser): Promise<Page | undefined> {
      const pages = await browser.pages();
      return await pages.reduce<Promise<Page | undefined>>((promise, page) => {
        return promise.then(async (result) => {
          if (result) {
            return result;
          }

          try {
            const isVisible = await page.evaluate(
              () => document.visibilityState === "visible"
            );

            if (isVisible) {
              return page;
            }
          } catch {
            // if nav happens while we are executing, this will fail. Need to restart
            return await scanPages(browser);
          }
        });
      }, Promise.resolve(undefined));
    }
  }

  async close(): Promise<void> {
    if (!this.browser) {
      return;
    }

    const { browser } = this;
    this.browser = undefined;

    await browser.close();
  }

  async closeAllPagesForHostname(hostname: string, except?: Page) {
    if (!this.browser) {
      return;
    }

    const pages = await this.browser.pages();

    await Promise.all(
      pages.map(async (p) => {
        if (p === except) {
          return;
        }

        const url = new URL(p.url());
        if (url.hostname === hostname) {
          await p.close();
        }
      })
    );
  }

  launch(): Promise<Browser> {
    if (this.browser) {
      return Promise.resolve(this.browser);
    }
    return this._launch();
  }

  async newIncognitoPage(): Promise<Page> {
    const browser = await this.launch();
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    page.on("close", () => {
      context.close();
    });
    return page;
  }

  async newPage(): Promise<Page> {
    const browser = await this.launch();

    return await browser.newPage();
  }

  async tryToReusePage(url: string | URL): Promise<Page> {
    const browser = await this.launch();
    const pages = await browser.pages();

    let page: Page | undefined;

    try {
      page = pages.find((p) => this.pageMatches(p, url));
    } catch {}

    if (!page) {
      page = await browser.newPage();
    }

    await page.goto(url.toString());

    return page;
  }

  private pageMatches(page: Page, url: URL | string): boolean {
    return page.url() === url.toString();
  }
}
