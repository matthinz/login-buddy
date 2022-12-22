import { promises as fs } from "fs";
import { CommandFunctions } from "../../types";

const LANGUAGES = ["en", "fr", "es"] as const;

export type Options = {
  name?: string;
};

const REGEX = /^(screenshots?|shoot)\b(.*)/i;

export function parse(line: string): Options | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }

  return {
    name: m[2].trim(),
  };
}

export async function run(
  options: Options,
  { getPage }: CommandFunctions
): Promise<void> {
  const page = await getPage();
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
}

export function runFromUserInput(
  line: string,
  funcs: CommandFunctions
): Promise<void> | undefined {
  const options = parse(line);
  return options ? run(options, funcs) : undefined;
}
