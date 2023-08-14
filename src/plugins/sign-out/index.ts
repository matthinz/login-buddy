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
          (await browser.tryToReusePage(options.baseURL)).mainFrame();

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
  const url = new URL("/account", baseURL);

  await frame.goto(url.toString());

  const actualUrl = new URL(frame.url());
  let message: string | undefined;

  if (actualUrl.pathname !== url.pathname) {
    // Assume we got redirected and are already logged out
    await frame.goto(new URL("/logout", baseURL).toString());
    message = "You're already logged out.";
  } else {
    // Assume we're still logged in and click the "Sign out" button
    await frame.click('form[action="/logout"].button_to button[type=submit]');

    message =
      (await frame.evaluate(() => {
        return (
          document.querySelector<HTMLElement>(".usa-alert--info")?.innerText ??
          ""
        );
      })) ?? "";
  }

  if (completely) {
    const cookies = await frame.page().cookies();
    await Promise.all(
      cookies.map(async (cookie) => {
        await frame.page().deleteCookie({
          name: cookie.name,
        });
      })
    );

    await frame.page().reload();
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
  const cleanUp = raw.cleanUp == null ? true : !!raw.cleanUp;

  return {
    cleanUp,
    completely,
    baseURL,
  };
}
