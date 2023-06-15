import getopts from "getopts";

import {
  GlobalState,
  Message,
  PluginOptions,
  ProgramOptions,
} from "../../types";
import { VERIFY_FLOW } from "./flow";
import {
  ThreatMetrixResult,
  THREATMETRIX_RESULTS,
  VerifyOptions,
} from "./types";
import { BrowserHelper } from "../../browser";
import { EventBus } from "../../events";
import { untilPathIncludes } from "../../dsl";

const DEFAULT_PHONE = "3602345678";

// > Simulates a phone number that couldn’t be verified as belonging to the user
// https://developers.login.gov/testing/
const BAD_PHONE = "703-555-5555";

export function idvPlugin({ browser, events, programOptions }: PluginOptions) {
  events.on("command:verify", async ({ args, state }) => {
    const options = parseOptions(args, programOptions);
    await verify(options, browser, state.current(), events);
  });
}

async function verify(
  options: VerifyOptions,
  browser: BrowserHelper,
  state: GlobalState,
  events: EventBus
) {
  const { lastSignup } = state;

  if (!lastSignup) {
    throw new Error("You need to run `signup` before you can verify.");
  }

  const page = await browser.tryToReusePage(options.baseURL);
  const frame = page.mainFrame();

  const inputState = {
    ...lastSignup,
    phone: options.phone ?? lastSignup.phone ?? DEFAULT_PHONE,
  };

  await VERIFY_FLOW.run({
    hooks: untilPathIncludes(options.until),
    options: {
      ...options,
      getLinkToHybridFlow: createHybridFlowLinkMonitor(events),
      getMobileBrowserFrame() {
        return browser.newIncognitoPage().then((page) => page.mainFrame());
      },
    },
    frame,
    state: inputState,
  });
}

export function parseOptions(
  args: string[],
  { baseURL }: ProgramOptions
): VerifyOptions {
  const raw = getopts(args, {
    alias: {
      threatMetrix: ["threatmetrix"],
      badId: ["bad-id"],
      badPhone: ["bad-phone"],
      barcodeReadError: ["barcode-read-error", "bad-barcode"],
      gpoPartial: ["gpo-partial"],
      inPerson: ["in-person", "ipp"],
      mvaTimeout: ["mva-timeout", "mva-error"],
      throttlePhone: ["throttle-phone"],
      throttleSsn: ["throttle-ssn"],
    },
    boolean: [
      "badId",
      "badPhone",
      "barcodeReadError",
      "gpo",
      "gpoPartial",
      "mvaTimeout",
      "throttlePhone",
      "throttleSsn",
    ],
  });

  let threatMetrix = raw.threatMetrix == null ? "pass" : raw.threatMetrix;
  if (!THREATMETRIX_RESULTS.includes(threatMetrix)) {
    throw new Error("Invalid value for --threatmetrix");
  }

  const inPerson = !!raw.inPerson;

  const badId = !!raw.badId || inPerson;

  const gpoPartial = !!raw.gpoPartial;

  const gpo = gpoPartial ? "partial" : !!raw.gpo ? "complete" : false;

  const hybrid = !!raw.hybrid;

  const until = raw.until;

  const throttlePhone = !!raw.throttlePhone;

  let phone = raw.phone == null ? undefined : String(raw.phone);

  if (throttlePhone) {
    if (phone) {
      throw new Error("Can't specify --phone and --throttle-phone");
    }
    if (gpo) {
      throw new Error("Can't specify --throttle-phone and --gpo");
    }
    phone = BAD_PHONE;
  }

  if (raw.badPhone) {
    if (phone != null) {
      throw new Error("Can't specify --phone and --bad-phone");
    }
    phone = BAD_PHONE;
  }

  const throttleSsn = !!raw.throttleSsn;

  const ssn = throttleSsn
    ? undefined
    : raw.ssn == null
    ? undefined
    : String(raw.ssn);

  const mvaTimeout = !!raw.mvaTimeout;

  const barcodeReadError = !!raw.barcodeReadError;

  return {
    badId,
    barcodeReadError,
    baseURL,
    gpo,
    hybrid,
    inPerson,
    mvaTimeout,
    phone,
    ssn,
    threatMetrix: threatMetrix as ThreatMetrixResult,
    throttlePhone,
    throttleSsn,
    until,
  };
}

function createHybridFlowLinkMonitor(
  events: EventBus
): () => Promise<string | undefined> {
  const TIMEOUT = 4 * 1000;
  const POLL_INTERVAL = 300;
  let messages: Message[] = [];

  events.on("message", ({ message }) => {
    if (message.type !== "sms") {
      return;
    }
    messages.push(message);
  });

  return () =>
    new Promise((resolve) => {
      const startedAt = new Date();
      check();

      function check() {
        messages.sort((x, y) => {
          return x.time.getTime() - y.time.getTime();
        });

        for (let i = messages.length - 1; i >= 0; i--) {
          const message = messages[i];

          const looksLikeHybridMessage = message.body.includes(
            "Take a photo of your ID"
          );

          if (looksLikeHybridMessage) {
            const m = /https?:\/\/[^\s]+/.exec(messages[i].body);
            if (m) {
              messages = [];
              resolve(m[0]);
              return;
            }
          }
        }

        if (Date.now() - startedAt.getTime() > TIMEOUT) {
          messages = [];
          return;
        }

        setTimeout(check, POLL_INTERVAL);
      }
    });
}
