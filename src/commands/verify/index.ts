import { P, ParsedType } from "p-block";
import getopts from "getopts";
import { Page } from "puppeteer";
import { FlowRunOptions, until } from "../../dsl";

import { GlobalState } from "../../types";
import { runFromPageFancy } from "../utils";
import { VERIFY_FLOW } from "./flow";

const UNTIL_ALIASES: { [key: string]: string | RegExp } = {
  verify: /(\/verify\/doc_auth\/verify|\/verify\/verify_info)/,
};

export const THREATMETRIX_OPTIONS = ["no_result", "pass", "reject", "review"];

export const verifyParametersParser = P.object()
  .withProperties({
    threatMetrix: P.string().isIn(THREATMETRIX_OPTIONS),
    gpo: P.boolean(),
    until: P.string().optional(),
  })
  .defaultedTo({
    gpo: false,
    threatMetrix: "no_result",
  });

export type VerifyOptions = ParsedType<typeof verifyParametersParser> &
  Omit<FlowRunOptions, "page">;

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

  const parsed = verifyParametersParser.parse(raw);
  if (!parsed.success) {
    parsed.errors.forEach((err) => {
      console.error(err.message);
    });
    return undefined;
  }

  return {
    ...parsed.parsed,
    baseURL,
    onWarning(message: string) {},
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
