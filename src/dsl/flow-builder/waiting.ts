import { Frame, HTTPRequest, Page } from "puppeteer";

export const SHORT_WAIT = 1 * 1000;
export const MEDIUM_WAIT = 3.5 * 1000;
export const LONG_WAIT = 6 * 1000;
export const REALLY_LONG_WAIT = 2 * LONG_WAIT;
export const JUST_A_RIDICULOUSLY_LONG_WAIT = 2 * REALLY_LONG_WAIT;

/**
 * Attempts to wait for the page to do _something_ (e.g. navigate) after
 * some user interaction.
 */
export function waitForTheFrameToDoSomething(
  frame: Frame,
  verboseLogging = !!process.env["VERBOSE_WAIT_LOGGING"]
): Promise<void> {
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
    waitUntilNoRequests(page, MEDIUM_WAIT, verboseLogging),
  ]);
}

export function waitUntilNoRequests(
  page: Page,
  quietTimeInMs: number,
  verboseLogging: boolean
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

  let lastPendingCountReport: string | undefined;

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | undefined;

    const pendingRequests: PendingRequest[] = [];
    let lastFinishedRequest: FinishedRequest | undefined;

    const doResolve = () => {
      page.off("request", requestHandler);
      page.off("requestfailed", requestFinishedHandler);
      page.off("requestfinished", requestFinishedHandler);
      page.off("requestservedfromcache", requestFinishedHandler);
      page.off("framenavigated", navigationHandler);
      resolve();
    };

    const cancelTimer = () => {
      if (!timer) {
        return;
      }
      verboseLogging && console.error("Cancel timer");
      clearTimeout(timer);
      timer = undefined;
    };

    const requestHandler = (req: HTTPRequest) => {
      const pendingRequest = {
        request: req,
        startedAt: Date.now(),
      };

      pendingRequests.push(pendingRequest);

      cancelTimer();
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

      const pendingCountReport =
        pendingRequests.length < 10
          ? pendingRequests.length.toString()
          : `~${Math.floor(Math.ceil(pendingRequests.length / 10) * 10)}`;

      if (lastPendingCountReport !== pendingCountReport) {
        verboseLogging && console.error("%s pending", pendingCountReport);
        lastPendingCountReport = pendingCountReport;
      }

      if (pendingRequests.length > 0) {
        return;
      }

      // We're out of pending requests. Now we want to wait at least until
      // <quietTimeInMs> OR the 150% of the time since the last
      // finished request was _started_, whichever is longer
      const timeToWait = Math.max(
        quietTimeInMs,
        (Date.now() - (lastFinishedRequest?.startedAt ?? Date.now())) * 1.5
      );

      verboseLogging && console.error("Wait %dms", timeToWait);

      cancelTimer();

      timer = setTimeout(doResolve, quietTimeInMs);
    };

    const navigationHandler = (frame: Frame) => {
      if (frame === page.mainFrame()) {
        verboseLogging && console.error("Navigation: reset state");
        pendingRequests.splice(0, pendingRequests.length);
        lastFinishedRequest = undefined;
        cancelTimer();
      }
    };

    page.on("request", requestHandler);
    page.on("requestfailed", requestFinishedHandler);
    page.on("requestfinished", requestFinishedHandler);
    page.on("requestservedfromcache", requestFinishedHandler);
    page.on("framenavigated", navigationHandler);

    timer = setTimeout(doResolve, quietTimeInMs);
  });
}
