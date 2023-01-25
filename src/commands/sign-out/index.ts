import getopts from "getopts";
import { P, ParsedType } from "p-block";
import { Browser } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromBrowser } from "../utils";

const signOutParametersParser = P.object().withProperties({
  completely: P.boolean().defaultedTo(false),
});

type Parameters = ParsedType<typeof signOutParametersParser>;

const ALIASES = ["signout", "logout"];

export function parse(args: string[]): Parameters | undefined {
  const cmd = args.shift();
  if (cmd == null || !ALIASES.includes(cmd)) {
    return;
  }

  const raw = getopts(args);
  const parsed = signOutParametersParser.parse(raw);
  if (!parsed.success) {
    parsed.errors.forEach((err) => console.error(err));
    return;
  }

  return parsed.parsed;
}

export const run = runFromBrowser(
  async (browser: Browser, params: Parameters, globalState: GlobalState) => {
    const {
      programOptions: { baseURL },
    } = globalState;

    const url = new URL("/logout", baseURL);

    const page = await browser.newPage();
    await page.goto(url.toString());
    await page.waitForNetworkIdle();

    const message =
      (await page.evaluate(() => {
        // @ts-ignore
        return document.querySelector(".usa-alert--info")?.innerText ?? "";
      })) ?? "";

    if (params.completely) {
      const cookies = await page.cookies();
      await Promise.all(
        cookies.map(async (cookie) => {
          await page.deleteCookie({
            name: cookie.name,
          });
        })
      );
    }

    if (message) {
      console.error(message);
    }

    // Close every other page except the one we just opened

    const pages = await browser.pages();

    await Promise.all(
      pages.map(async (p) => {
        if (p === page) {
          return;
        }

        const url = new URL(p.url());
        if (url.hostname === baseURL.hostname) {
          await p.close();
        }
      })
    );

    return globalState;
  }
);
