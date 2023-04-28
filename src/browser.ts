import { Browser, Page } from "puppeteer";

export class BrowserHelper {
  private readonly _launch: () => Promise<Browser>;
  private browser: Browser | undefined;

  constructor(browser: Browser);
  constructor(launcher: () => Promise<Browser>);
  constructor(browserOrLauncher: Browser | (() => Promise<Browser>)) {
    if (typeof browserOrLauncher === "function") {
      this._launch = () =>
        browserOrLauncher().then((browser) => {
          this.browser = browser;
          return browser;
        });
    } else {
      this._launch = () => Promise.resolve(browserOrLauncher);
      this.browser = browserOrLauncher;
    }
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
