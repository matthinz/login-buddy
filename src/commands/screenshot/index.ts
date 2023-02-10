import fs from "node:fs/promises";
import { Browser, Page, Target } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromActivePage, runFromBrowser } from "../utils";

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

export const run = runFromActivePage(
  async (page: Page, globalState: GlobalState, options: ScreenshotOptions) => {
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

        const name = (options.name ?? "") === "" ? "screenshot" : options.name;
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
