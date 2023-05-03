import getopts from "getopts";
import { Browser, launch, Page } from "puppeteer";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { BrowserHelper } from "../../browser";

type SignOutOptions = {
  baseURL: URL;
  completely: boolean;
};

const ALIASES = ["logout", "signout"];

export function signOutPlugin({
  browser,
  events,
  programOptions,
}: PluginOptions) {
  ALIASES.forEach((alias) => {
    events.on(`command:${alias}`, async ({ args, state }) => {
      const options = parseOptions(args, programOptions);
      const nextState = await signOut(state.current(), options, browser);
      state.update(nextState);
    });
  });
}

async function signOut(
  state: GlobalState,
  { baseURL, completely }: SignOutOptions,
  browser: BrowserHelper
): Promise<GlobalState> {
  const page = await browser.newPage();
  const url = new URL("/logout", baseURL);

  await page.goto(url.toString());
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

  await browser.closeAllPagesForHostname(baseURL.hostname);

  return {
    ...state,
  };
}

export function parseOptions(
  args: string[],
  { baseURL }: ProgramOptions
): SignOutOptions {
  const raw = getopts(args);
  const completely = raw.completely == null ? false : !!raw.completely;

  return {
    completely,
    baseURL,
  };
}
