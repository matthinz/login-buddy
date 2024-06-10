import getopts from "getopts";
import fs from "node:fs/promises";
import path from "node:path";
import { Page } from "puppeteer";
import { BrowserHelper } from "../../browser";
import { PluginOptions } from "../../types";

const LANGUAGES_BY_CODE = {
  en: "English",
  es: "Spanish",
  fr: "French",
} as const;

type LanguageCode = keyof typeof LANGUAGES_BY_CODE;

const LANGUAGE_CODES = Object.keys(LANGUAGES_BY_CODE) as LanguageCode[];

// These tweaks applied when taking screenshots.
const TWEAKS = [
  {
    when: (url: URL) => url.pathname.endsWith("/verify/ssn"),
    remove: "[role=status].usa-alert--info",
  },
  {
    when: (url: URL) => url.pathname.endsWith("/verify/ssn"),
    hide: 'form[action*="/verify/ssn"] lg-password-toggle + div',
  },
] as const;

export type ScreenshotOptions = {
  before: boolean;
  html: boolean;
  name: string;
  en: boolean;
  es: boolean;
  fr: boolean;
};

type ScreenshotSet = { [key in LanguageCode]: string };

export function screenshotPlugin({ browser, events }: PluginOptions) {
  events.on("command:screenshot", async ({ args }) => {
    const options = parseOptions(args);

    await screenshot(browser, options);
  });
}

function parseOptions(args: string[]): ScreenshotOptions {
  const raw = getopts(args, {
    boolean: ["before", "html", "en", "fr", "es"],
  });

  let { en, es, fr } = raw;
  if (!(en || es || fr)) {
    en = es = fr = true;
  }

  return {
    before: !!raw.before,
    name: raw._.join(" ").trim(),
    html: !!raw.html,
    en,
    es,
    fr,
  };
}

async function screenshot(
  browser: BrowserHelper,
  { before, html, name, ...options }: ScreenshotOptions
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

  const languageCodes = [
    options.en && "en",
    options.es && "es",
    options.fr && "fr",
  ].filter(Boolean) as LanguageCode[];

  const screenshots = await languageCodes.reduce<
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
    if (page.url() !== originalUrl.toString()) {
      console.log("restore to %s", originalUrl);
      await page.goto(originalUrl.toString());
    }
  }

  if (html) {
    renderHtmlTable(screenshots as ScreenshotSet);
  }
}

async function applyTweaksToPage(page: Page) {
  const url = new URL(page.url());

  type Tweak =
    | {
        remove: string;
        hide?: string | undefined;
      }
    | { hide: string; remove?: string | undefined };

  const tweaksToApply: Tweak[] = TWEAKS.filter(({ when }) => when(url)).map(
    ({ when, ...rest }) => rest
  );

  await page.evaluate((tweaksToApply) => {
    tweaksToApply.forEach(({ remove, hide }) => {
      if (remove != null) {
        const els = [].slice.call(document.querySelectorAll(remove));
        els.forEach((el: Node) => el.parentNode?.removeChild(el));
      }

      if (hide != null) {
        const els = [].slice.call(document.querySelectorAll(hide));
        els.forEach((el: HTMLElement) => (el.style.display = "none"));
      }
    });
  }, tweaksToApply);
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
  const pageLang = await page.evaluate(() => document.documentElement.lang);

  if (pageLang !== lang) {
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
  }

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

  await fs
    .mkdir(path.dirname(file), {
      recursive: true,
    })
    .catch(() => {});

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
    "screenshots/",
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
