import { Page } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromPage } from "../utils";
import { LOG_IN } from "./flow";

type Parameters = {};

export function parse(args: string[]): Parameters | void {
  const cmd = args.shift();
  if (cmd !== "login") {
    return;
  }
  return {};
}

export const run = runFromPage(
  "/",
  async (page: Page, _params: Parameters, globalState: GlobalState) => {
    const {
      lastSignup,
      programOptions: { baseURL },
    } = globalState;

    if (!lastSignup) {
      throw new Error("You haven't signed up yet");
    }

    const updatedSignUpState = await LOG_IN.run(lastSignup, {
      page,
      baseURL,
    });

    return {
      ...globalState,
      lastSignup: {
        ...updatedSignUpState,
      },
    };
  }
);
