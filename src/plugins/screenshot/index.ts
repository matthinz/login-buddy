import getopts from "getopts";
import fs from "node:fs/promises";
import { Page } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { PluginOptions } from "../../types";

const LANGUAGES_BY_CODE = {
  en: "English",
  es: "Spanish",
  fr: "French",
} as const;

type LanguageCode = keyof typeof LANGUAGES_BY_CODE;
type LanguageName = typeof LANGUAGES_BY_CODE[LanguageCode];

const LANGUAGES = Object.values(LANGUAGES_BY_CODE) as LanguageName[];
const LANGUAGE_CODES = Object.keys(LANGUAGES_BY_CODE) as LanguageCode[];

// These tweaks applied when taking screenshots.
// This array is passed to Page.evaluate(), so it needs to be
const TWEAKS = [
  {
    path: "^/(en|fr|es)/verify/doc_auth/ssn$",
    remove: "[role=status].usa-alert--info",
  },
];

export type ScreenshotOptions = {
  before: boolean;
  html: boolean;
  name: string;
};

type ScreenshotSet = { [key in LanguageCode]: string };

export function screenshotPlugin({ events, state }: PluginOptions) {
  events.on("command:screenshot", async ({ args, browser }) => {
    const options = parseOptions(args);

    await screenshot(browser, options);
  });
}

function parseOptions(args: string[]): ScreenshotOptions {
  const raw = getopts(args);

  return {
    before: !!raw.before,
    name: raw._.join(" ").trim(),
    html: !!raw.html,
  };
}

async function screenshot(
  browser: BrowserHelper,
  { before, html, name }: ScreenshotOptions
) {
  const page = await browser.activePage();
  if (!page) {
    console.error("No active page!");
    return;
  }

  const originalUrl = page.url();

  name =
    name === ""
      ? new URL(originalUrl).pathname
          .replace(/\//g, "-")
          .replace(/(^-+|-+$)/g, "")
          .replace(/^$/, "home")
          .toLowerCase()
      : name;

  const screenshots = await LANGUAGE_CODES.reduce<
    Promise<Partial<ScreenshotSet>>
  >(
    (promise, lang) =>
      promise.then(async (screenshots) => {
        const file = await takeScreenshot(page, name, lang, before);
        screenshots[lang] = file;
        return screenshots;
      }),
    Promise.resolve({})
  );

  if (originalUrl) {
    console.log("restore to %s", originalUrl);
    await page.goto(originalUrl.toString());
  }

  if (html) {
    renderHtmlTable(screenshots as ScreenshotSet);
  }
}

async function applyTweaksToPage(page: Page) {
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
}

async function renderHtmlTable(screenshots: ScreenshotSet) {
  const td = makeTag("td");
  const th = makeTag("th");
  const tr = makeTag("tr");
  const tbody = makeTag("tbody");
  const thead = makeTag("thead");

  console.log(
    [
      "<table>",

      ...LANGUAGE_CODES.map((lang) =>
        [
          thead(tr(th(LANGUAGES_BY_CODE[lang]))),
          tbody(tr(td("", screenshots[lang], ""))),
        ].join("\n")
      ),
      "</table>",
    ].join("\n")
  );

  function makeTag(tagName: string) {
    return (...content: any[]) =>
      [`<${tagName}>`, ...content, `</${tagName}>`].join("\n");
  }
}

async function takeScreenshot(
  page: Page,
  name: string,
  lang: LanguageCode,
  before: boolean
): Promise<string> {
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

  let after = false;

  if (!before) {
    // This is not a "before" image. If one exists, call this an "after"
    const beforeFilename = buildFilename({
      lang,
      name,
      after: false,
      before: true,
    });
    try {
      after = (await fs.stat(beforeFilename)).isFile();
    } catch {
      after = false;
    }
  }

  const file = buildFilename({
    lang,
    name,
    before,
    after,
  });

  await fs.rm(file).catch(() => {});

  console.log("Writing %s...", file);

  await applyTweaksToPage(page);

  await page.screenshot({
    path: file,
    fullPage: true,
  });

  return file;
}

function buildFilename({
  lang,
  name,
  before = false,
  after = false,
}: {
  lang: LanguageCode;
  name: string;
  before: boolean;
  after: boolean;
}): string {
  return [
    name,
    "-",
    lang,
    before ? "-BEFORE" : "",
    after ? "-AFTER" : "",
    ".png",
  ]
    .filter(Boolean)
    .join("");
}
