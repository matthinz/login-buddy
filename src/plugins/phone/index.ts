import { Browser, Page } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { PluginOptions } from "../../types";

const TELEPHONY_MONITORING_URL = "/test/telephony";
const POLL_DELAY = 3000;

/**
 * This plugin, in local environments, keeps a browser tab open
 * to the /test/telephony route and reports any SMS / voice messages
 * it sees there.
 */
export function phonePlugin({ events, programOptions, state }: PluginOptions) {
  if (programOptions.environment !== "local") {
    return;
  }

  let page: Page | undefined;

  events.on("newBrowser", async () => {
    await createAndTrackPage(new BrowserHelper(events, state));
  });

  async function createAndTrackPage(browser: BrowserHelper) {
    try {
      page?.close();
    } catch {}

    page = undefined;

    const activePage = await browser.activePage();

    try {
      page = await browser.newPage();
    } catch {
      // We're probably exiting or something
      return;
    }

    await page.goto(
      new URL(TELEPHONY_MONITORING_URL, programOptions.baseURL).toString()
    );

    if (activePage) {
      await activePage.bringToFront();
    }

    while (true) {
      if (page == null) {
        setTimeout(() => {
          createAndTrackPage(browser), POLL_DELAY;
        });
        return;
      }

      const success = await pollForMessages(page);

      if (!success) {
        page = undefined;
        // We've probably lost the page
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY));
    }
  }

  async function pollForMessages(page: Page): Promise<boolean> {
    try {
      await page.reload();
    } catch {
      return false;
    }

    const result = await page.evaluate(() => {
      // Remove the meta refresh, since we're handling it
      const meta = document.querySelector("meta[http-equiv=refresh]");
      meta?.parentNode?.removeChild(meta);

      const h2s = [].slice.call(
        document.querySelectorAll("h2")
      ) as HTMLElement[];

      const messagesH2 = h2s.find((el) => el.innerText.trim() === "Messages");
      if (messagesH2) {
        const cards = [].slice.call(
          messagesH2.parentNode?.querySelectorAll(".lg-card") ?? []
        ) as HTMLElement[];
        const texts = cards.map((card) => {
          const pieces: string[] = [];
          for (let c = card.firstChild; c; c = c.nextSibling) {
            if (c.nodeName === "P") {
              const p = c.cloneNode(true) as HTMLElement;
              if (p.firstChild?.nodeName === "STRONG") {
                p.removeChild(p.firstChild);
              }
              pieces.push(p.innerText.trim());
            }
          }
          console.log(pieces);
        });
      }
    });

    return true;
  }
}
