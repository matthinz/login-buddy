import { Page } from "puppeteer";
import { promises as fs } from "fs";
import { Flow, FlowItem } from "./types";

export const SCREENSHOT_FLOW: Flow = [
  ...["en", "es", "fr"].map(
    (lang): FlowItem => ({
      name: lang,
      async run(tab, state) {
        state.originalUrl = state.originalUrl ?? tab.url();

        const url = await tab.evaluate((lang): string | undefined => {
          // @ts-ignore
          const a: HTMLAnchorElement | null = document.querySelector(
            `.language-picker a[lang=${lang}]`
          );
          return a ? a.href.toString() : undefined;
        }, lang);

        if (!url) {
          throw new Error(`Could not find url for language ${lang}`);
        }

        await tab.goto(url);

        const { tag = "screenshot" } = state;
        const file = `${tag}-${lang}.png`;

        await fs.rm(file).catch(() => {});

        console.log("Writing %s...", file);

        await tab.screenshot({
          path: file,
          fullPage: true,
        });
      },
    })
  ),
  {
    name: "restore",
    async run(tab: Page, state: Record<string, unknown>) {
      const { originalUrl } = state;
      delete state.originalUrl;
      console.log("restore to %s", originalUrl);
      if (originalUrl) {
        await tab.goto(originalUrl.toString());
      }
    },
  },
];
