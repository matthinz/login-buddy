import fs from "node:fs/promises";
import path from "node:path";
import {
  AssertAction,
  ClickAction,
  Context,
  ExpectUrlAction,
  NavigateAction,
  RawValue,
  RuntimeValue,
  SelectAction,
  SubmitAction,
  TypeAction,
  UploadAction,
} from "./types";
import { HTTPRequest, Page } from "puppeteer";

const SHORT_WAIT = 1 * 1000;
const MEDIUM_WAIT = 2.5 * 1000;
const LONG_WAIT = 5 * 1000;
const REALLY_LONG_WAIT = 2 * LONG_WAIT;
const JUST_A_RIDICULOUSLY_LONG_WAIT = 2 * REALLY_LONG_WAIT;

export function assert<
  InputState extends {},
  State extends InputState,
  Options
>(
  check: (
    context: Context<InputState, State, Options>
  ) => boolean | void | Promise<boolean | void>,
  message?:
    | string
    | ((
        context: Context<InputState, State, Options>
      ) => string | Promise<string>)
): AssertAction<InputState, State, Options> {
  let messageFunc: (
    context: Context<InputState, State, Options>
  ) => Promise<string>;

  if (message == null) {
    messageFunc = () => Promise.resolve("");
  } else {
    messageFunc = bindRuntimeValueResolver<string, InputState, State, Options>(
      message
    );
  }

  const checkFunc = async (context: Context<InputState, State, Options>) => {
    const result = check(context);
    if (result === true || result === false) {
      return result;
    } else if (result == null) {
      return true;
    } else {
      const actual = await result;
      return actual == null ? true : actual;
    }
  };

  return {
    type: "assert",
    check: checkFunc,
    message: messageFunc,
    async perform(context: Context<InputState, State, Options>) {
      if (await checkFunc(context)) {
        return;
      }

      const message = await messageFunc(context);
      throw new Error(message);
    },
  };
}

export function click<InputState extends {}, State extends InputState, Options>(
  selector: RuntimeValue<string, InputState, State, Options>
): ClickAction<InputState, State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "click",
    selector: selectorFunc,
    async perform(context: Context<InputState, State, Options>) {
      const selector = await selectorFunc(context);
      const { frame } = context;

      try {
        await context.frame.click(selector);
        return;
      } catch (err: any) {
        if (err.message.includes("not clickable")) {
          if (await clickFallback()) {
            return;
          }
        }

        err.message = `${err.message} (selector: ${selector})`;
        throw err;
      }

      function clickFallback(): Promise<boolean> {
        return frame.evaluate((selector) => {
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) {
            return false;
          }
          el.click();
          return true;
        }, selector);
      }
    },
  };
}

export function expectUrl<
  InputState extends {},
  State extends InputState,
  Options
>(
  url: RuntimeValue<URL | string, InputState, State, Options>,
  normalizer?: (input: URL) => string | URL
): ExpectUrlAction<InputState, State, Options> {
  const urlFunc = async (context: Context<InputState, State, Options>) => {
    const resolved = await resolveRuntimeValue(url, context);
    return resolveURL(resolved, context.options);
  };
  return {
    type: "expect_url",
    url: urlFunc,
    async perform(context) {
      const expected = await urlFunc(context);
      const actual = new URL(context.frame.url());

      // By default, strip hash + querystring
      normalizer =
        normalizer ??
        ((input: URL): string | URL => {
          const result = new URL(input);
          result.hash = "";
          result.search = "";
          return result;
        });

      const theyMatch =
        normalizer(expected).toString() === normalizer(actual).toString();

      if (!theyMatch) {
        const err: Error & { code?: string } = new Error(
          `Expected URL ${expected.toString()}, but got ${actual.toString()}`
        );
        err.code = "expect_url";
        throw err;
      }
    },
  };
}

export function navigate<
  InputState extends {},
  State extends InputState,
  Options extends unknown | { baseURL: URL }
>(
  url: RuntimeValue<string | URL, InputState, State, Options>
): NavigateAction<InputState, State, Options> {
  const urlFunc = async (context: Context<InputState, State, Options>) => {
    const resolved = await resolveRuntimeValue(url, context);
    return resolveURL(resolved, context.options);
  };

  return {
    type: "navigate",
    url: urlFunc,
    async perform(context: Context<InputState, State, Options>) {
      const url = await urlFunc(context);
      await context.frame.goto(url.toString());
    },
  };
}

export function select<
  InputState extends {},
  State extends InputState,
  Options
>(
  selector: RuntimeValue<string, InputState, State, Options>,
  value: RuntimeValue<string, InputState, State, Options>
): SelectAction<InputState, State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const valueFunc = bindRuntimeValueResolver(value);
  return {
    type: "select",
    selector: selectorFunc,
    value: valueFunc,
    async perform(context: Context<InputState, State, Options>) {
      const [selector, value] = await Promise.all([
        selectorFunc(context),
        valueFunc(context),
      ]);

      const { frame } = context;

      await frame.select(selector, value);
    },
  };
}

export function submit<
  InputState extends {},
  State extends InputState,
  Options
>(
  selector: RuntimeValue<string, InputState, State, Options>
): SubmitAction<InputState, State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "submit",
    selector: selectorFunc,
    async perform(context: Context<InputState, State, Options>) {
      const selector = await selectorFunc(context);
      const { frame } = context;

      await Promise.all([
        frame.click(selector),
        waitForThePageToDoSomething(frame.page()),
      ]);
    },
  };
}

export function type<InputState extends {}, State extends InputState, Options>(
  selector: RuntimeValue<string, InputState, State, Options>,
  value: RuntimeValue<string | number, InputState, State, Options>
): TypeAction<InputState, State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const valueFunc = bindRuntimeValueResolver(value);
  return {
    type: "type",
    selector: selectorFunc,
    value: valueFunc,
    async perform(context: Context<InputState, State, Options>) {
      const [selector, value] = await Promise.all([
        selectorFunc(context),
        valueFunc(context),
      ]);

      await context.frame.type(selector, String(value));
    },
  };
}

export function upload<
  InputState extends {},
  State extends InputState,
  Options
>(
  selector: RuntimeValue<string, InputState, State, Options>,
  filename: RuntimeValue<string, InputState, State, Options>,
  contents: RuntimeValue<string | Buffer, InputState, State, Options>
): UploadAction<InputState, State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const filenameFunc = bindRuntimeValueResolver(filename);
  const contentsFunc = bindRuntimeValueResolver(contents);
  return {
    type: "upload",
    selector: selectorFunc,
    filename: filenameFunc,
    contents: contentsFunc,
    async perform(context: Context<InputState, State, Options>): Promise<void> {
      const [selector, filename, contents] = await Promise.all([
        selectorFunc(context),
        filenameFunc(context),
        contentsFunc(context),
      ]);

      const tempFile = path.join(".tmp", filename);
      await fs
        .mkdir(path.dirname(tempFile), {
          recursive: true,
        })
        .catch((err) => {
          console.error(err);
        });
      await fs.writeFile(tempFile, contents ?? "");

      const { frame } = context;

      await frame.waitForSelector(selector, { timeout: LONG_WAIT });

      const [fileChooser] = await Promise.all([
        frame.page().waitForFileChooser(),
        frame.click(selector),
      ]);

      await fileChooser.accept([path.resolve(tempFile)]);
    },
  };
}

async function resolveRuntimeValue<
  T extends RawValue,
  InputState extends {},
  State extends InputState,
  Options
>(
  this: any,
  value: RuntimeValue<T, InputState, State, Options>,
  context: Context<InputState, State, Options>
): Promise<T> {
  if (typeof value === "function") {
    const result = value(context);
    return result instanceof Promise ? await result : result;
  }
  return value;
}

function bindRuntimeValueResolver<
  T extends RawValue,
  InputState extends {},
  State extends InputState,
  Options
>(
  value: RuntimeValue<T, InputState, State, Options>
): (context: Context<InputState, State, Options>) => Promise<T> {
  // TODO: Figure this out.
  // @ts-ignore
  return resolveRuntimeValue.bind(undefined, value);
}

function resolveURL<Options extends unknown | { baseURL: URL }>(
  value: string | URL,
  options: Options
): URL {
  // XXX: Derive from a baseURL without
  const { baseURL } = options ?? ({} as any);
  return baseURL instanceof URL ? new URL(value, baseURL) : new URL(value);
}

function waitForThePageToDoSomething(page: Page): Promise<void> {
  // This promise will resolve when the page initiates a request related to navigation
  const navigationRequestPromise = new Promise<"navigationRequest">(
    (resolve) => {
      const handler = (request: HTTPRequest) => {
        if (request.isNavigationRequest()) {
          page.off("request", handler);
          resolve("navigationRequest");
        }
      };
      page.on("request", handler);
    }
  );

  // This promise will resolve when the page has actually navigated
  const navigationPromise = page
    .waitForNavigation({
      timeout: JUST_A_RIDICULOUSLY_LONG_WAIT,
      waitUntil: "load",
    })
    .then(() => "navigation")
    .catch(() => {});

  return Promise.race([
    navigationRequestPromise,
    navigationPromise,
    delay(MEDIUM_WAIT),
  ]).then((winner) => {
    if (winner === "navigation") {
      // We've already navigated, just go with it
      return;
    } else if (winner === "navigationRequest") {
      // We've had a request come in that will eventually lead to navigation.
      // Wait for that all to settle
      return navigationPromise.then(() => {});
    } else {
      // Navigation has not been initiated. There might be XHR requests pending
      // or something. Just wait for everything to settle.
      return page.waitForNetworkIdle({
        idleTime: SHORT_WAIT,
        timeout: LONG_WAIT,
      });
    }
  });
}

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
