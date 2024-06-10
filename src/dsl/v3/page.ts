import { ElementHandle, Frame } from "puppeteer";
import { Page } from "./types";

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
  private readonly prev: Promise<PageState>;

  constructor(prev: Frame | Promise<PageState>) {
    this.prev = prev instanceof Frame ? Promise.resolve({ frame: prev }) : prev;
  }

  click(selector: string): Promise<void> & Page {
    return this.derive(async (frame) => {
      await frame.click(selector);
      return selector;
    });
  }

  goto(url: string | URL): Promise<void> & Page {
    return this.derive((frame) => frame.goto(url.toString()).then(NOOP));
  }

  selectorExists(selector: string): Promise<boolean> {
    return this.prev.then(async ({ frame }) => {
      const $el = await frame.$(selector);
      return !!$el;
    });
  }

  setValue(selector: string, value: string | number): Promise<void> & Page {
    return this.setValues({
      [selector]: value,
    });
  }

  setValues(values: {
    [selector: string]: string | number;
  }): Promise<void> & Page {
    const selectors = Object.keys(values);

    return this.derive((frame) =>
      selectors.reduce<Promise<string | undefined>>(
        (promise, selector) =>
          promise.then(async (lastSelector) => {
            const el = await frame.$(selector);
            const nodeName = await (
              await el?.getProperty("nodeName")
            )?.jsonValue();

            // We will use different methods to write values based on the kind
            // of things we're writing to.

            switch (nodeName) {
              case "SELECT":
                await frame.select(selector, String(values[selector]));
                break;
              default:
                await clearInput(frame, selector);
                await frame.type(selector, String(values[selector]));
                break;
            }

            return selector;
          }),
        Promise.resolve(undefined)
      )
    );
  }

  submit(selector?: string | undefined): Promise<void> & Page {
    return new PuppeteerPageImpl(
      this.prev.then(async ({ frame, lastSelector }) => {
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
    return this.prev.then(({ frame }) => new URL(frame.url()));
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
    return this.prev.then(NOOP).then(onfulfilled, onrejected);
  }
  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
  ): Promise<void | TResult> {
    return this.prev.then(NOOP).catch(onrejected);
  }
  finally(onfinally?: (() => void) | null | undefined): Promise<void> {
    return this.prev.then(NOOP).finally(onfinally);
  }

  [Symbol.toStringTag] = RESOLVED_PROMISE[Symbol.toStringTag];

  private derive(
    func: (frame: Frame) => Promise<void | string>
  ): Page & Promise<void> {
    return new PuppeteerPageImpl(
      this.prev.then(async ({ frame, lastSelector }) => {
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
