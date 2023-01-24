import { ensureBrowserLaunched, getPageForUrl } from "../../browser";
import { GlobalState } from "../../types";
import { makeRunner } from "../utils";
import { LOG_IN } from "./flow";

type Parameters = {};

export function parse(args: string[]): Parameters | void {
  const cmd = args.shift();
  if (cmd !== "login") {
    return;
  }
  return {};
}

export const run = makeRunner(
  async (
    _params: Parameters,
    globalState: GlobalState
  ): Promise<GlobalState> => {
    let newGlobalState = {
      ...(await ensureBrowserLaunched(globalState)),
    };

    const {
      browser,
      lastSignup,
      programOptions: { baseURL },
    } = newGlobalState;

    if (!lastSignup) {
      throw new Error("You haven't signed up yet");
    }

    let page = await getPageForUrl("/", newGlobalState);

    if (!page) {
      page = await browser.newPage();
      await page.goto(baseURL.toString());
    }

    const state = await LOG_IN.run(
      {
        ...lastSignup,
      },
      {
        browser,
        page,
        baseURL,
      }
    );

    return {
      ...newGlobalState,
      lastSignup: {
        ...lastSignup,
        backupCodes: state.backupCodes,
      },
    };
  }
);
