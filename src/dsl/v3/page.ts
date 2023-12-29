import { ElementHandle, Frame } from "puppeteer";
import { Page, PrimitiveType } from "./types";
import { Url } from "url";

const NOOP = () => {};
const RESOLVED_PROMISE = Promise.resolve();
const DEFAULT_SUBMIT_SELECTOR =
  "form button[type=submit], form input[type=submit]";

type PageState = {
  frame: Frame;
  lastSelector?: string;
};

/**
 * An implementation of `Page` that drives a browser via Puppeteer.
 */
export class PuppeteerPageImpl implements Page, Promise<void> {
  readonly #prev: Promise<PageState>;

  constructor(prev: Frame | Promise<PageState>) {
    if (typeof prev === "object" && "then" in prev) {
      this.#prev = prev;
    } else {
      this.#prev = Promise.resolve({
        frame: prev,
      });
    }
  }

  click(selector: string): Promise<void> & Page {
    return this.derive(async (frame) => {
      await frame.click(selector);
      return selector;
    });
  }

  clickLinkTo(urlOrPath: string | URL): Promise<void> & Page {
    return this.derive(async (frame) => {
      const pageURL = new URL(frame.url());
      const urlToClick = new URL(urlOrPath, pageURL);

      const links = await frame.$$("a[href]");

      const candidates = (
        await Promise.all(
          links.map(async (el) => {
            const hrefProperty = await el.getProperty("href");
            const href = String(await hrefProperty.jsonValue());
            const link = new URL(href, pageURL);

            if (link.hostname !== urlToClick.hostname) {
              return;
            }

            if (link.pathname !== urlToClick.pathname) {
              return;
            }

            return { el, link };
          })
        )
      ).filter(Boolean) as unknown as {
        el: ElementHandle<HTMLLinkElement>;
        link: URL;
      }[];

      if (candidates.length === 0) {
        throw new Error(`No links to '${urlOrPath}' found on page.`);
      }

      if (candidates.length > 1) {
        candidates.sort((a, b) => score(b.link) - score(a.link));
      }

      const { el } = candidates[0];

      await el.click();

      await frame.waitForNavigation();

      function score(url: URL): number {
        return ["hostname", "pathname", "search", "hash"].filter(
          (prop) => (url as any)[prop] === (urlToClick as any)[prop]
        ).length;
      }
    });
  }

  goto(url: string | URL): Promise<void> & Page {
    return this.derive((frame) => frame.goto(url.toString()).then(NOOP));
  }

  async selectorExists(selector: string): Promise<boolean> {
    const { frame } = await this.#prev;
    const el = await frame.$(selector);
    return !!el;
  }

  setValue(selector: string, value: string | number): Promise<void> & Page {
    return this.setValues({
      [selector]: value,
    });
  }

  setValues(values: {
    [selector: string]: PrimitiveType;
  }): Promise<void> & Page {
    return this.derive(
      async (frame) => await setValuesBySelector(frame, values)
    );
  }

  setValuesByName(values: {
    [name: string]: PrimitiveType;
  }): Promise<void> & Page {
    const valuesBySelector: { [selector: string]: PrimitiveType } = {};

    Object.keys(values).forEach((name) => {
      const selector = `[name="${escapeName(name)}"]`;
      valuesBySelector[selector] = values[name];
    });

    return this.setValues(valuesBySelector);

    function escapeName(name: string): string {
      return name;
    }
  }

  submit(selector?: string | undefined): Promise<void> & Page {
    return new PuppeteerPageImpl(
      this.#prev.then(async ({ frame, lastSelector }) => {
        let elementToClick: ElementHandle<Element> | null;

        if (selector) {
          elementToClick = await frame.$(selector);
        } else if (lastSelector) {
          elementToClick = await findSubmitButtonFor(frame, lastSelector);
        } else {
          elementToClick = await frame.$(
            "form button[type=submit], form input[type=submit]"
          );
        }

        if (!elementToClick) {
          throw new Error("Can't find element to click ");
        }

        await Promise.all([elementToClick.click(), frame.waitForNavigation()]);

        return { frame, lastSelector };
      })
    );
  }

  upload(
    selector: string,
    filename: string,
    contents: string
  ): Promise<void> & Page {
    throw new Error("Method not implemented.");
  }

  url(): Promise<URL> {
    return this.#prev.then(({ frame }) => new URL(frame.url()));
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?:
      | ((value: void) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ): Promise<TResult1 | TResult2> {
    return this.#prev.then(NOOP).then(onfulfilled, onrejected);
  }
  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
  ): Promise<void | TResult> {
    return this.#prev.then(NOOP).catch(onrejected);
  }
  finally(onfinally?: (() => void) | null | undefined): Promise<void> {
    return this.#prev.then(NOOP).finally(onfinally);
  }

  [Symbol.toStringTag] = RESOLVED_PROMISE[Symbol.toStringTag];

  private derive(
    func: (frame: Frame) => Promise<void | string>
  ): Page & Promise<void> {
    return new PuppeteerPageImpl(
      this.#prev.then(async ({ frame, lastSelector }) => {
        const newLastSelector = await func(frame);
        return {
          frame,
          lastSelector: newLastSelector ?? lastSelector,
        };
      })
    );
  }
}

function clearInput(frame: Frame, selector: string): Promise<void> {
  return frame.evaluate((selector) => {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el) {
      el.value = "";
    }
  }, selector);
}

async function findSubmitButtonFor(
  frame: Frame,
  selector: string
): Promise<ElementHandle<Element> | null> {
  // First find the form
  let el: ElementHandle<Element> | null = await frame.$(selector);

  while (el && (await nodeName(el)) !== "FORM") {
    el = await el.$("xpath/..");
  }

  if (!el) {
    return null;
  }

  return el.$(DEFAULT_SUBMIT_SELECTOR);

  async function nodeName(
    el: ElementHandle<Element | Node> | null
  ): Promise<string | undefined> {
    if (!el) {
      return;
    }
    return await (await el.getProperty("nodeName")).jsonValue();
  }
}

function setValuesBySelector(
  frame: Frame,
  values: { [selector: string]: PrimitiveType }
): Promise<void> {
  const selectors = Object.keys(values);
  return selectors.reduce<Promise<void>>(
    (p, selector) =>
      p.then(async () => setValueBySelector(frame, selector, values[selector])),
    Promise.resolve()
  );
}

async function setValueBySelector(
  frame: Frame,
  selector: string,
  value: PrimitiveType
): Promise<void> {
  const elements = await frame.$$(selector);

  if (elements.length === 0) {
    throw new Error(`No elements found with selector '${selector}'`);
  }

  const el =
    elements.length === 1
      ? elements[0]
      : disambiguateMultipleElements(elements);

  const nodeNameProperty = await el.getProperty("nodeName");
  const nodeName = await nodeNameProperty.jsonValue();

  switch (nodeName) {
    case "SELECT":
      await setSelectValue(el as ElementHandle<HTMLSelectElement>);
      break;

    case "INPUT":
      if (await isInputOfType("checkbox", el)) {
        await setCheckboxValue(el);
        return;
      }

      if (await isInputOfType("hidden", el)) {
      }

      await el.evaluate((el) => {
        (el as HTMLInputElement).value = "";
      });
      await el.type(String(value));
      break;

    default:
      throw new Error(`Cannot set the value of ${nodeName}`);
  }

  async function setCheckboxValue(el: ElementHandle<HTMLInputElement>) {}

  async function setSelectValue(el: ElementHandle<HTMLSelectElement>) {}

  async function setTextValue(el: ElementHandle<HTMLInputElement>) {}

  async function isInputOfType(
    type: string,
    el: ElementHandle<Element>
  ): Promise<boolean> {
    const tagName = String(
      await (await el.getProperty("tagName")).jsonValue()
    ).toLowerCase();

    if (tagName !== "input") {
      return false;
    }

    const actualType = String(await (await el.getProperty("type")).jsonValue());

    return type.toLowerCase() === actualType.toLowerCase();
  }

  function disambiguateMultipleElements(
    elements: ElementHandle<Element>[]
  ): ElementHandle<Element> {
    throw new Error("Function not implemented.");
  }
}
