import { Page } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromPage } from "../utils";
import { LOG_IN } from "./flow";

type LogInOptions = {
  baseURL: URL;
};

export function parseOptions(
  args: string[],
  { programOptions: { baseURL } }: GlobalState
): LogInOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "login") {
    return;
  }
  return { baseURL };
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
