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
  /*
  When a network request returns:
  - If there are still pending requests, break
  - Look at the time since the last network request returned.
  - Wait at least that long for a new request to _start_
  - If that wait would be less than <seconds> from the start of waiting,
    wait until then.
 */

  type PendingRequest = {
    startedAt: number;
    request: HTTPRequest;
  };

  type FinishedRequest = PendingRequest & {
    finishedAt: number;
  };

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;

    const pendingRequests: PendingRequest[] = [];
    let lastStartedRequest: PendingRequest | undefined;
    let lastFinishedRequest: FinishedRequest | undefined;

    const waitingStartedAt = Date.now();

    const doResolve = () => {
      page.off("request", requestHandler);
      page.off("requestfinished", requestFinishedHandler);
      resolve();
    };

    const requestHandler = (req: HTTPRequest) => {
      const pendingRequest = {
        request: req,
        startedAt: Date.now(),
      };

      pendingRequests.push(pendingRequest);

      lastStartedRequest = pendingRequest;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    const requestFinishedHandler = (req: HTTPRequest) => {
      const index = pendingRequests.findIndex(({ request }) => request === req);

      if (index >= 0) {
        const pendingRequest = pendingRequests[index];
        pendingRequests.splice(index, 1);

        lastFinishedRequest = {
          ...pendingRequest,
          finishedAt: Date.now(),
        };
      }

      if (pendingRequests.length > 0) {
        return;
      }

      // We're out of pending requests. Now we want to wait at least until
      // <quietTimeInMs> after we started waiting OR the time since the last
      // finished request was _started_, whichever is longer
      const timeToWait = Math.max(
        waitingStartedAt + quietTimeInMs - Date.now(),
        Date.now() - (lastFinishedRequest?.startedAt ?? Date.now()),
        0
      );

      timer = setTimeout(doResolve, timeToWait);
    };

    page.on("request", requestHandler);
    page.on("requestfinished", requestFinishedHandler);

    timer = setTimeout(doResolve, quietTimeInMs);
  });
}
