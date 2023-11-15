import getopts from "getopts";

import {
  CommandEvent,
  GlobalState,
  Message,
  PluginOptions,
  ProgramOptions,
} from "../../types";
import { CANCEL_IDV_FLOW, VERIFY_FLOW } from "./flow";
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

const aliases = {
  verify: ["verify"],
  cancel_idv: ["cancel_idv", "cancelidv", "startover", "start_over"],
};

export function idvPlugin({ browser, events, programOptions }: PluginOptions) {
  aliases.verify.forEach((alias) => {
    events.on(`command:${alias}`, handleVerify);
  });

  aliases.cancel_idv.forEach((alias) => {
    events.on(`command:${alias}`, handleCancelVerify);
  });

  async function handleVerify({ args, state }: CommandEvent) {
    const options = parseOptions(args, programOptions);
    await verify(options, browser, state.current(), events);
  }

  async function handleCancelVerify({}: CommandEvent) {
    await cancelIdv(programOptions.baseURL, browser);
  }
}

async function cancelIdv(baseURL: URL, browser: BrowserHelper) {
  const page = await browser.tryToReusePage(baseURL);
  const frame = page.mainFrame();

  await CANCEL_IDV_FLOW.run({
    frame,
    options: { baseURL },
    state: {},
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
      throttleGpo: ["throttle-gpo"],
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
      "pr",
      "throttleGpo",
      "throttlePhone",
      "throttleSsn",
    ],
  });

  let threatMetrix: ThreatMetrixResult | undefined;

  switch (raw.threatMetrix) {
    case "no_result":
    case "pass":
    case "reject":
    case "review":
      threatMetrix = raw.threatMetrix;
      break;
    default:
      if (threatMetrix) {
        throw new Error("Invalid value for --threatmetrix");
      }
  }

  const inPerson = !!raw.inPerson;

  const badId = !!raw.badId || inPerson;

  const { gpoPartial, throttleGpo, gpo } = raw;

  if (throttleGpo && gpoPartial) {
    throw new Error("Can't specify --throttle-gpo and --gpo-partial");
  }

  let shouldRequestLetter = false;
  let shouldEnterGpoOtp = false;

  if (gpo || throttleGpo) {
    shouldRequestLetter = true;
    shouldEnterGpoOtp = true;
  }

  if (gpoPartial) {
    shouldRequestLetter = true;
    shouldEnterGpoOtp = false;
  }

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

  const state: string | undefined = raw.pr ? "PR" : undefined;

  return {
    badId,
    barcodeReadError,
    baseURL,
    hybrid,
    inPerson,
    mvaTimeout,
    phone,
    ssn,
    state,
    shouldEnterGpoOtp,
    shouldRequestLetter,
    threatMetrix: threatMetrix as ThreatMetrixResult,
    throttleGpo,
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
