import getopts from "getopts";
import { Page } from "puppeteer";
import { until } from "../../dsl";

import { GlobalState } from "../../types";
import { runFromPageFancy } from "../utils";
import { VERIFY_FLOW } from "./flow";
import { VerifyParameters, verifyParametersParser } from "./types";

const UNTIL_ALIASES: { [key: string]: string | RegExp } = {
  verify: /(\/verify\/doc_auth\/verify|\/verify\/verify_info)/,
};

export function parse(args: string[]): VerifyParameters | undefined {
  const cmd = args.shift();
  if (cmd !== "verify") {
    return;
  }

  const raw = getopts(args, {
    alias: {
      threatMetrix: ["threatmetrix"],
    },
  });

  const parsed = verifyParametersParser.parse(raw);

  if (parsed.success) {
    return parsed.parsed;
  } else {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
  }
}

export const run = runFromPageFancy(
  ["/verify", "/account"],
  async (browser) => browser.newPage(),
  async (page: Page, params: VerifyParameters, globalState: GlobalState) => {
    const { lastSignup } = globalState;

    if (!lastSignup) {
      throw new Error("No signup");
    }

    const runOptions = {
      ...globalState.programOptions,
      ...params,
      page,
    };

    const untilArg = params.until
      ? UNTIL_ALIASES[params.until] ?? params.until
      : undefined;

    if (untilArg) {
      await VERIFY_FLOW.run(lastSignup, runOptions, until(untilArg));
    } else {
      await VERIFY_FLOW.run(lastSignup, runOptions);
    }
  }
);
