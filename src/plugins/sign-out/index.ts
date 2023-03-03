import getopts from "getopts";
import { Browser, launch, Page } from "puppeteer";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";

type SignOutOptions = {
  baseURL: URL;
  completely: boolean;
};

const ALIASES = ["logout", "signout"];

export function signOutPlugin({
  events,
  programOptions,
  state,
}: PluginOptions) {
  ALIASES.forEach((alias) => {
    events.on(`command:${alias}`, async ({ args, state }) => {
      const options = parseOptions(args, programOptions);
      const nextState = await signOut(state.current(), options);
      state.update(nextState);
    });
  });
}

async function signOut(
  state: GlobalState,
  { baseURL, completely }: SignOutOptions
): Promise<GlobalState> {
  const browser =
    state.browser ??
    (await launch({
      headless: false,
      defaultViewport: null,
    }));

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

  await closeAllPagesForHostname(browser, baseURL.hostname, page);

  return {
    ...state,
    browser,
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

async function closeAllPagesForHostname(
  browser: Browser,
  hostname: string,
  except?: Page
) {
  const pages = await browser.pages();

  await Promise.all(
    pages.map(async (p) => {
      if (p === except) {
        return;
      }

      const url = new URL(p.url());
      if (url.hostname === hostname) {
        await p.close();
      }
    })
  );
}
