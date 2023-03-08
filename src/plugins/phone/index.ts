import { load, CheerioAPI } from "cheerio";
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
export function phonePlugin({
  events,
  programOptions: { baseURL, environment },
}: PluginOptions) {
  if (environment !== "local") {
    return;
  }

  const messages: Message[] = [];

  pollForMessages(false);

  function pollForMessages(emitEvents = true) {
    const telephonyUrl = new URL(TELEPHONY_MONITORING_URL, baseURL);
    fetch(telephonyUrl.toString()).then(async (resp) => {
      if (!resp.ok) {
        setTimeout(pollForMessages, POLL_DELAY);
      }

      const $ = load(await resp.text());

      const messagesOnPage = [
        ...getMessagesOnPage("sms", $),
        ...getMessagesOnPage("voice", $),
      ];

      const newMessages = messagesOnPage.filter((message) => {
        const alreadyReceived = messages.some(
          (m) =>
            m.type === message.type &&
            m.to === message.to &&
            m.body === message.body &&
            m.time.getTime() === message.time.getTime()
        );
        return !alreadyReceived;
      });

      messages.push(...newMessages);

      if (emitEvents) {
        await Promise.all(
          newMessages.map((message) => events.emit("message", { message }))
        );
      }

      setTimeout(pollForMessages, POLL_DELAY);
    });
  }
}

function getMessagesOnPage(type: "sms" | "voice", $: CheerioAPI): Message[] {
  // Each message is in a card element.
  // Here we grab the text lines, then parse them.

  const headingText = type === "sms" ? "Messages" : "Calls";

  const $h2s = $("h2").filter(function (_, el) {
    return $(el).text().trim() === headingText;
  });

  if ($h2s.length === 0) {
    return [];
  }

  const $cards = $h2s.parent().find(".lg-card");
  const rawMessages: string[][] = [];

  $cards.each(function (_, card) {
    const lines: string[] = [];
    $(card)
      .children("p")
      .each((_, p) => {
        lines.push($(p).text().trim());
      });
    rawMessages.push(lines);
  });

  return rawMessages.map((lines) => parseMessage(lines, type));
}
