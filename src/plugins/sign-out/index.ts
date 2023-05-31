import getopts from "getopts";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { BrowserHelper } from "../../browser";
import { Frame } from "puppeteer";

type SignOutOptions = {
  baseURL: URL;
  frame?: Frame;
  cleanUp: boolean;
  completely: boolean;
};

const ALIASES = ["logout", "signout", "sign-out", "log-out"];

export function signOutPlugin({ browser, events }: PluginOptions) {
  ALIASES.forEach((alias) => {
    events.on(
      `command:${alias}`,
      async ({ args, frameId, programOptions, state }) => {
        const options = parseOptions(args, programOptions);
        const frame =
          (await browser.getFrameById(frameId)) ??
          (await browser.newPage()).mainFrame();
        const nextState = await signOut(
          state.current(),
          options,
          frame,
          browser
        );
        state.update(nextState);
      }
    );
  });
}

async function signOut(
  state: GlobalState,
  { baseURL, cleanUp, completely }: SignOutOptions,
  frame: Frame,
  browser: BrowserHelper
): Promise<GlobalState> {
  const url = new URL("/logout", baseURL);

  const page = frame.page();

  await frame.goto(url.toString());
  await page.waitForNetworkIdle();

  const message =
    (await page.evaluate(() => {
      return (
        document.querySelector<HTMLElement>(".usa-alert--info")?.innerText ?? ""
      );
    })) ?? "";

  if (completely) {
    const cookies = await page.cookies();
    await Promise.all(
      cookies.map(async (cookie) => {
        await page.deleteCookie({
          name: cookie.name,
        });
      })
    );

    await page.reload();
  }

  if (message) {
    console.log(message);
  }

  if (cleanUp) {
    await browser.closeAllPagesForHostname(baseURL.hostname);
  }

  return {
    ...state,
    loggedIn: false,
  };
}

export function parseOptions(
  args: string[],
  { baseURL }: ProgramOptions
): SignOutOptions {
  const raw = getopts(args, {
    alias: {
      cleanUp: ["clean-up", "tidy"],
    },
    boolean: ["cleanUp", "completely"],
  });
  const completely = raw.completely == null ? false : !!raw.completely;
  const cleanUp = raw.cleanUp == null ? true : !!raw.completely;

  return {
    cleanUp,
    completely,
    baseURL,
  };
}
