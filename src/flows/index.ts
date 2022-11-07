import { Page } from "puppeteer";
import { Flow, FlowItem } from "./types";

export type RunFlowOptions = {
  state?: Record<string, unknown>;
  tab: Page;
};

export function runFlow(
  flow: Flow,
  { tab, state: incomingState }: RunFlowOptions
): Promise<Record<string, unknown>> {
  const state: Record<string, unknown> = incomingState ?? {};

  const promise = flow.reduce<Promise<boolean>>(
    (promise, item, index) =>
      promise.then(async (keepGoing) => {
        if (!keepGoing) {
          // We've short-circuited out
          return false;
        }

        if (index === 0) {
          // First item, we navigate to the URL
          if (item.url) {
            console.log("Initial navigation: %s", item.url);
            await tab.goto(item.url);
          }
        } else {
          // We need to submit the previous item if it has a submitSelector
          const { submitSelector } = flow[index - 1];
          if (submitSelector) {
            await doSubmit(submitSelector);
          }
        }

        if (item.url) {
          const actualUrl = tab.url();
          if (actualUrl != item.url) {
            console.log(
              "At wrong URL. Expected to be at '%s', but at '%s'",
              item.url,
              actualUrl
            );
          }
        }

        if (item.run) {
          await item.run(tab, state);
        }

        return true;
      }),
    Promise.resolve(true)
  );

  return promise.then(async (keepGoing) => {
    if (!keepGoing) {
      return state;
    }

    const { submitSelector } = flow[flow.length - 1];
    if (submitSelector) {
      await doSubmit(submitSelector);
    }

    return state;
  });

  function doSubmit(selector: string): Promise<unknown> {
    console.log("Submit: %s", selector);
    return Promise.all([tab.click(selector), tab.waitForNavigation()]);
  }
}
