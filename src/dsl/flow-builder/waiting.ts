import { Frame, HTTPRequest, Page } from "puppeteer";

export const SHORT_WAIT = 1 * 1000;
export const MEDIUM_WAIT = 3.5 * 1000;
export const LONG_WAIT = 5 * 1000;
export const REALLY_LONG_WAIT = 2 * LONG_WAIT;
export const JUST_A_RIDICULOUSLY_LONG_WAIT = 2 * REALLY_LONG_WAIT;

/**
 * Attempts to wait for the page to do _something_ (e.g. navigate) after
 * some user interaction.
 */
export function waitForTheFrameToDoSomething(frame: Frame): Promise<void> {
  /*
    THINGS WE WANT TO DETECT

    - Page navigation
    - No network activity for a few seconds after a flurry of xhr requests

  */

  const page = frame.page();

  return Promise.race([
    frame
      .waitForNavigation({
        timeout: JUST_A_RIDICULOUSLY_LONG_WAIT,
      })
      .catch(() => {})
      .then(() => {}),
    waitUntilNoRequests(page, MEDIUM_WAIT),
  ]);
}

export function waitUntilNoRequests(
  page: Page,
  quietTimeInMs: number
): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;

    const pendingRequests: HTTPRequest[] = [];

    const doResolve = () => {
      page.off("request", requestHandler);
      page.off("requestfinished", requestFinishedHandler);

      resolve();
    };

    const requestHandler = (req: HTTPRequest) => {
      pendingRequests.push(req);

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const requestFinishedHandler = (req: HTTPRequest) => {
      const index = pendingRequests.indexOf(req);
      if (index >= 0) {
        pendingRequests.splice(index, 1);
      }

      if (pendingRequests.length === 0) {
        timer = setTimeout(doResolve, quietTimeInMs);
      }
    };

    page.on("request", requestHandler);
    page.on("requestfinished", requestFinishedHandler);

    timer = setTimeout(doResolve, quietTimeInMs);
  });
}

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
