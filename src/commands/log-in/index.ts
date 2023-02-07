import getopts from "getopts";
import { env } from "process";
import { Page } from "puppeteer";
import { resolveSpOptions } from "../../sp";
import { GlobalState } from "../../types";
import { runFromPage } from "../utils";
import { LOG_IN } from "./flow";
import { LogInOptions } from "./types";

export function parseOptions(
  args: string[],
  { programOptions: { baseURL, environment } }: GlobalState
): LogInOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "login") {
    return;
  }

  const raw = getopts(args);

  const sp = resolveSpOptions(raw, environment, baseURL);

  return { baseURL, sp };
}

export const run = runFromPage(
  "/",
  async (
    page: Page,
    globalState: GlobalState,
    options: LogInOptions,
    hooks
  ) => {
    const { lastSignup } = globalState;

    if (!lastSignup) {
      throw new Error("You haven't signed up yet");
    }

    const updatedSignUpState = await LOG_IN.run(
      lastSignup,
      {
        ...options,
        page,
      },
      hooks
    );

    return {
      ...globalState,
      lastSignup: {
        ...updatedSignUpState,
      },
    };
  }
);
