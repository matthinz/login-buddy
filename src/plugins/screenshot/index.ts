import fs from "node:fs/promises";
import { Browser, Page } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { GlobalState, PluginOptions } from "../../types";

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

export function screenshotPlugin({ events, state }: PluginOptions) {
  events.on("command:screenshot", async ({ args, browser }) => {
    const options = parseOptions(args);
    await screenshot(browser, options);
  });
}

function parseOptions(args: string[]): ScreenshotOptions {
  return {
    name: args.join(" ").trim(),
  };
}

async function screenshot(browser: BrowserHelper, { name }: ScreenshotOptions) {
  const page = await browser.activePage();
  if (!page) {
    console.error("No active page!");
    return;
  }

  const originalUrl = page.url();

  await LANGUAGES.reduce<Promise<void>>(function (promise, lang) {
    return promise.then(async () => {
      const url = await page.evaluate((lang): string | undefined => {
        const a = document.querySelector<HTMLAnchorElement>(
          `.language-picker a[lang=${lang}]`
        );
        return a ? a.href.toString() : undefined;
      }, lang);

      if (!url) {
        throw new Error(`Could not find URL for language ${lang}`);
      }

      await page.goto(url);

      name = (name ?? "").trim() === "" ? "screenshot" : name;
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
}
