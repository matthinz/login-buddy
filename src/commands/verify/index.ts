import getopts from "getopts";
import { Page } from "puppeteer";
import { until } from "../../dsl";

import { GlobalState } from "../../types";
import { runFromPageFancy } from "../utils";
import { VERIFY_FLOW } from "./flow";
import {
  ThreatMetrixResult,
  THREATMETRIX_RESULTS,
  VerifyOptions,
} from "./types";

const UNTIL_ALIASES: { [key: string]: string | RegExp } = {
  verify: /(\/verify\/doc_auth\/verify|\/verify\/verify_info)/,
};

export function parseOptions(
  args: string[],
  { programOptions: { baseURL } }: GlobalState
): VerifyOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "verify") {
    return;
  }

  const raw = getopts(args, {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  let threatMetrix = raw.threatMetrix == null ? "no_result" : raw.threatMetrix;
  if (!THREATMETRIX_RESULTS.includes(threatMetrix)) {
    throw new Error("Invalid value for --threatmetrix");
  }

  const gpo = !!raw.gpo;

  const hybrid = !!raw.hybrid;

  const until = raw.until;

  const ssn = raw.ssn == null ? undefined : String(raw.ssn);

  return {
    baseURL,
    hybrid,
    gpo,
    ssn,
    threatMetrix: threatMetrix as ThreatMetrixResult,
    until,
  };
}

export const run = runFromPageFancy(
  ["/verify", "/account"],
  async (browser) => browser.newPage(),
  async (
    page: Page,
    globalState: GlobalState,
    options: VerifyOptions,
    hooks
  ) => {
    const { lastSignup } = globalState;

    if (!lastSignup) {
      throw new Error("No signup");
    }

    const runOptions = {
      ...options,
      page,
    };

    const untilArg = options.until
      ? UNTIL_ALIASES[options.until] ?? options.until
      : undefined;

    await VERIFY_FLOW.run(lastSignup, runOptions, {
      ...hooks,
      shouldStop: untilArg ? until(untilArg) : () => false,
    });

    return globalState;
  }
);
