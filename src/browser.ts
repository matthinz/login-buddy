import { Browser, Frame, Page } from "puppeteer";

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

  async getFrameById(frameId?: string): Promise<Frame | undefined> {
    if (!this.browser) {
      return;
    }

    if (!frameId) {
      return;
    }

    const pages = await this.browser.pages();
    for (const page of pages) {
      for (const frame of page.frames()) {
        if (frame.name() === `browser-${frameId}`) {
          return frame;
        }
      }
    }
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

    const urlAsURL = url instanceof URL ? url : new URL(url);

    const pagesWithScores = pages
      .map((page) => ({
        page,
        score: this.scorePageMatch(page, urlAsURL),
      }))
      .filter(({ score }) => score > 0);

    pagesWithScores.sort((x, y) => y.score - x.score);

    let page = pagesWithScores.shift()?.page;

    if (!page) {
      page = await browser.newPage();
    }

    await page.goto(url.toString());

    return page;
  }

  private scorePageMatch(page: Page, url: URL): number {
    try {
      const pageUrl = new URL(page.url());

      if (pageUrl.toString() == url.toString()) {
        return 10;
      }

      if (pageUrl.hostname !== url.hostname) {
        return 0;
      }

      if (pageUrl.pathname === url.pathname) {
        return 5;
      }

      if (pageUrl.pathname.startsWith(url.pathname)) {
        return 2;
      }

      if (url.pathname.startsWith(pageUrl.pathname)) {
        return 2;
      }

      return 0;
    } catch (err) {
      return 0;
    }
  }

  private pageMatches(page: Page, url: URL | string): boolean {
    return page.url() === url.toString();
  }
}
