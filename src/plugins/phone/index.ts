import { Page } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { Message, PluginOptions } from "../../types";
import { parseMessage } from "./parse";

const TELEPHONY_MONITORING_URL = "/test/telephony";
const INIT_DELAY = 1500;
const POLL_DELAY = 3000;
/**
 * This plugin, in local environments, keeps a browser tab open
 * to the /test/telephony route and reports any SMS / voice messages
 * it sees there.
 */
export function phonePlugin({ events, programOptions }: PluginOptions) {
  if (programOptions.environment !== "local") {
    return;
  }

  /**
   * Tracks the browser tab we're using to monitor the telephony debugging page.
   */
  let page: Page | undefined;

  const messages: Message[] = [];

  events.on("newBrowser", async ({ browser }) => {
    setTimeout(
      () => createAndTrackPage(new BrowserHelper(browser)),
      INIT_DELAY
    );
  });

  /**
   * Opens a page we can use to monitor the test telephony screen.
   */
  async function createAndTrackPage(browser: BrowserHelper) {
    try {
      await page?.close();
    } catch {}

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
      try {
        await activePage.bringToFront();
      } catch {}
    }

    pollForMessages();

    function pollForMessages() {
      messagePollingWorker()
        .catch(async (error) => {
          await events.emit("error", { error });
        })
        .finally(() => {
          setTimeout(pollForMessages, POLL_DELAY);
        });
    }

    async function messagePollingWorker(): Promise<void> {
      try {
        if (page) {
          await page.reload();
        }
      } catch {
        page = undefined;
      }

      if (!page) {
        // Somehow, we've lost our page.
        setTimeout(() => createAndTrackPage(browser), INIT_DELAY);
        return;
      }

      await disableMetaRefresh(page);

      const newMessages = [
        ...(await getNewMessagesOnPage(page, "sms", messages)),
        ...(await getNewMessagesOnPage(page, "voice", messages)),
      ];

      newMessages.forEach((message) => {
        messages.push(message);
      });

      await newMessages.reduce<Promise<void>>(
        (promise, message) =>
          promise.then(async () => {
            await events.emit("message", { message });
          }),
        Promise.resolve()
      );
    }
  }
}

async function disableMetaRefresh(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Remove the meta refresh, since we're handling it
    const meta = document.querySelector<HTMLMetaElement>(
      "meta[http-equiv=refresh]"
    );
    meta?.parentNode?.removeChild(meta);
  });
}

async function getNewMessagesOnPage(
  page: Page,
  type: "sms" | "voice",
  receivedMessages: Message[]
): Promise<Message[]> {
  // Each message is in a card element.
  // Here we grab the text lines, then parse them.

  const rawMessages = (await page.evaluate((type: "sms" | "voice") => {
    const h2s = [].slice.call(document.querySelectorAll("h2")) as HTMLElement[];
    const headingText = type === "sms" ? "Messages" : "Calls";
    const messagesH2 = h2s.find((el) => el.innerText.trim() === headingText);

    if (!messagesH2 || !messagesH2.parentNode) {
      return [];
    }

    const cards = [].slice.call(
      messagesH2.parentNode.querySelectorAll<HTMLElement>(".lg-card")
    ) as HTMLElement[];

    return cards.map((card) => {
      const lines: string[] = [];
      for (let c = card.firstChild; c; c = c.nextSibling) {
        if (c.nodeName === "P") {
          lines.push((c as HTMLElement).innerText);
        }
      }
      return lines;
    });
  }, type)) as string[][];

  const messagesOnPage = rawMessages.map((lines) => parseMessage(lines, type));

  return messagesOnPage.filter((message) => {
    const isNew = !receivedMessages.some(
      (m) =>
        m.type == message.type &&
        m.to === message.to &&
        m.time.getTime() === message.time.getTime()
    );
    return isNew;
  });
}
