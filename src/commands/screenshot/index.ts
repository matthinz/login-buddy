import fs from "node:fs/promises";
import { Browser } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromBrowser } from "../utils";

const LANGUAGES = ["en", "fr", "es"] as const;

export type ScreenshotOptions = {
  name?: string;
};

export function parseOptions(args: string[]): ScreenshotOptions | undefined {
  const cmd = args.shift();
  if (cmd !== "screenshot") {
    return;
  }

  return {
    name: args.join(" ").trim(),
  };
}

export const run = runFromBrowser(
  async (
    browser: Browser,
    globalState: GlobalState,
    options: ScreenshotOptions
  ) => {
    const pages = await browser.pages();
    const page = pages[0];

    if (!page) {
      throw new Error("No current page.");
    }

    const originalUrl = page.url();

    await LANGUAGES.reduce<Promise<void>>(function (promise, lang) {
      return promise.then(async () => {
        const url = await page.evaluate((lang): string | undefined => {
          // @ts-ignore
          const a: HTMLAnchorElement | null = document.querySelector(
            `.language-picker a[lang=${lang}]`
          );
          return a ? a.href.toString() : undefined;
        }, lang);

        if (!url) {
          throw new Error(`Could not find URL for language ${lang}`);
        }

        await page.goto(url);

        const name = options.name === "" ? "screenshot" : "";
        const file = `${name}-${lang}.png`;

        await fs.rm(file).catch(() => {});

        console.log("Writing %s...", file);

        await page.screenshot({
          path: file,
          fullPage: true,
        });
      });
    }, Promise.resolve());

    if (originalUrl) {
      console.log("restore to %s", originalUrl);
      await page.goto(originalUrl.toString());
    }

    return globalState;
  }
);
