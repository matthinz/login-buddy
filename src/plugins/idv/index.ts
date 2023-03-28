import getopts from "getopts";
import { launch } from "puppeteer";
import { until } from "../../dsl";

import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { VERIFY_FLOW } from "./flow";
import {
  ThreatMetrixResult,
  THREATMETRIX_RESULTS,
  VerifyOptions,
} from "./types";

const UNTIL_ALIASES: { [key: string]: string | RegExp } = {
  verify: /(\/verify\/doc_auth\/verify|\/verify\/verify_info)/,
};

const DEFAULT_PHONE = "3602345678";

// > Simulates a phone number that couldn’t be verified as belonging to the user
// https://developers.login.gov/testing/
const BAD_PHONE = "703-555-5555";

export function idvPlugin({ events, programOptions, state }: PluginOptions) {
  events.on("command:verify", async ({ args }) => {
    const options = parseOptions(args, programOptions);
    const nextState = await verify(state.current(), options);
    state.update(nextState);
  });
}

async function verify(
  state: GlobalState,
  options: VerifyOptions
): Promise<GlobalState> {
  const browser =
    state.browser ??
    (await launch({
      headless: false,
      defaultViewport: null,
    }));

  const { lastSignup } = state;

  if (!lastSignup) {
    throw new Error("You need to run `signup` before you can verify.");
  }

  const page = await browser.newPage();

  const runOptions = {
    ...options,
    page,
  };

  const untilArg = options.until
    ? UNTIL_ALIASES[options.until] ?? options.until
    : undefined;

  const inputState = {
    ...lastSignup,
    phone: options.phone ?? lastSignup.phone ?? DEFAULT_PHONE,
  };

  await VERIFY_FLOW.run(inputState, runOptions, {
    shouldStop: untilArg ? until(untilArg) : () => false,
  });

  return {
    ...state,
    browser,
    lastSignup,
  };
}

export function parseOptions(
  args: string[],
  { baseURL }: ProgramOptions
): VerifyOptions {
  const raw = getopts(args, {
    alias: {
      threatMetrix: ["threatmetrix"],
      badPhone: ["bad-phone"],
    },
  });

  let threatMetrix = raw.threatMetrix == null ? "pass" : raw.threatMetrix;
  if (!THREATMETRIX_RESULTS.includes(threatMetrix)) {
    throw new Error("Invalid value for --threatmetrix");
  }

  const gpo = !!raw.gpo;

  const hybrid = !!raw.hybrid;

  const until = raw.until;

  const ssn = raw.ssn == null ? undefined : String(raw.ssn);

  let phone = raw.phone == null ? undefined : String(raw.phone);

  if (raw.badPhone) {
    if (phone != null) {
      throw new Error("Can't specify --phone and --bad-phone");
    }
    phone = BAD_PHONE;
  }

  return {
    baseURL,
    hybrid,
    gpo,
    phone,
    ssn,
    threatMetrix: threatMetrix as ThreatMetrixResult,
    until,
  };
}
