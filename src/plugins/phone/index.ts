import { Browser, Page } from "puppeteer";
import { EventBus } from "../../events";
import { ProgramOptions } from "../../types";

const TELEPHONY_MONITORING_URL = "/test/telephony";
const POLL_DELAY = 3000;

/**
 * This plugin, in local environments, keeps a browser tab open
 * to the /test/telephony route and reports any SMS / voice messages
 * it sees there.
 */
export function phonePlugin(options: ProgramOptions, events: EventBus) {
  if (options.environment !== "local") {
    return;
  }

  let page: Page | undefined;

  events.on("browser", ({ browser }) => {
    createAndTrackPage(browser);
  });

  function createAndTrackPage(browser: Browser) {
    (async () => {
      try {
        page?.close();
      } catch {}

      page = undefined;

      try {
        page = await browser.newPage();
      } catch {
        // We're probably exiting or something
        return;
      }

      await page.goto(
        new URL(TELEPHONY_MONITORING_URL, options.baseURL).toString()
      );

      while (true) {
        if (page.isClosed()) {
          page = undefined;
          setImmediate(createAndTrackPage, browser);
          return;
        }

        await pollForMessages(page);
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAY));
      }
    })().catch((err) => {
      console.error(err);
    });
  }

  async function pollForMessages(page: Page): Promise<void> {
    await page.reload();

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
  }
}
