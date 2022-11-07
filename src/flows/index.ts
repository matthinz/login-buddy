import { Page } from "puppeteer";
import { Flow, FlowItem } from "./types";

export type RunFlowOptions = {
  state?: Record<string, unknown>;
  stopAt?: string;
  tab: Page;
};

export function runFlow(
  flow: Flow,
  { tab, state: incomingState, stopAt }: RunFlowOptions
): Promise<Record<string, unknown>> {
  let promise = Promise.resolve(true);

  let prev: FlowItem | undefined;

  const state: Record<string, unknown> = incomingState ?? {};

  for (let i = 0; i < flow.length; i++) {
    const item = flow[i];

    promise = promise.then(async (keepGoing) => {
      if (!keepGoing) {
        console.log("Not running %s", item.name);
        return false;
      }

      if (!prev) {
        if (item.url) {
          console.log("Navigate to %s", item.url);
          await tab.goto(item.url);
        }
      } else if (prev?.submitSelector) {
        console.log("Submit: %s", prev.submitSelector);
        await Promise.all([
          tab.click(prev.submitSelector),
          tab.waitForNavigation(),
        ]);
      }

      if (stopAt && item.name === stopAt) {
        prev = undefined;
        return false;
      }

      if (item.run) {
        await item.run(tab, state);
      }

      prev = item;
      return true;
    });
  }

  promise = promise.then(async (keepGoing) => {
    if (!keepGoing) {
      return false;
    }

    if (!prev) {
      return false;
    }

    if (prev?.submitSelector) {
      console.log("Submit: %s", prev.submitSelector);
      await Promise.all([
        tab.click(prev.submitSelector),
        tab.waitForNavigation(),
      ]);
    }
    return true;
  });

  return promise.then(() => state);
}
