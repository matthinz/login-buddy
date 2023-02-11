import fs from "node:fs/promises";
import { Browser, Page, Target } from "puppeteer";
import { GlobalState } from "../../types";
import { runFromActivePage, runFromBrowser } from "../utils";

const LANGUAGES = ["en", "fr", "es"] as const;

// These tweaks applied when taking screenshots.
// This array is passed to Page.evaluate(), so it needs to be
const TWEAKS = [
  {
    path: "^/(en|fr|es)/verify/doc_auth/ssn$",
    remove: "[role=status].usa-alert--info",
  },
];

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

        await page.evaluate((TWEAKS) => {
          TWEAKS.forEach(({ path, remove }) => {
            const atPath = new RegExp(path).test(window.location.pathname);
            if (!atPath) {
              return;
            }

            const els = [].slice.call(document.querySelectorAll(remove));
            els.forEach((el: Node) => el.parentNode?.removeChild(el));
          });
        }, TWEAKS);

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
