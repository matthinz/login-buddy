import getopts from "getopts";

import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { VERIFY_FLOW } from "./flow";
import {
  ThreatMetrixResult,
  THREATMETRIX_RESULTS,
  VerifyOptions,
} from "./types";
import { BrowserHelper } from "../../browser";

const DEFAULT_PHONE = "3602345678";

// > Simulates a phone number that couldn’t be verified as belonging to the user
// https://developers.login.gov/testing/
const BAD_PHONE = "703-555-5555";

export function idvPlugin({ browser, events, programOptions }: PluginOptions) {
  events.on("command:verify", async ({ args, state }) => {
    const options = parseOptions(args, programOptions);
    await verify(browser, state.current(), options);
  });
}

async function verify(
  browser: BrowserHelper,
  state: GlobalState,
  options: VerifyOptions
) {
  const { lastSignup } = state;

  if (!lastSignup) {
    throw new Error("You need to run `signup` before you can verify.");
  }

  const page = await browser.newPage();

  const inputState = {
    ...lastSignup,
    phone: options.phone ?? lastSignup.phone ?? DEFAULT_PHONE,
  };

  await VERIFY_FLOW.run({
    options,
    page,
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
      throttlePhone: ["throttle-phone"],
      throttleSsn: ["throttle-ssn"],
    },
    boolean: ["badId", "badPhone", "throttlePhone", "throttleSsn"],
  });

  let threatMetrix = raw.threatMetrix == null ? "pass" : raw.threatMetrix;
  if (!THREATMETRIX_RESULTS.includes(threatMetrix)) {
    throw new Error("Invalid value for --threatmetrix");
  }

  const badId = !!raw.badId;

  const gpo = !!raw.gpo;

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

  return {
    badId,
    baseURL,
    hybrid,
    gpo,
    phone,
    ssn,
    threatMetrix: threatMetrix as ThreatMetrixResult,
    throttlePhone,
    throttleSsn,
    until,
  };
}
