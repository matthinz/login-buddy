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

export function assert<State, Options>(
  check: (
    context: Context<State, Options>
  ) => boolean | void | Promise<boolean | void>,
  message?:
    | string
    | ((context: Context<State, Options>) => string | Promise<string>)
): AssertAction<State, Options> {
  let messageFunc: (context: Context<State, Options>) => Promise<string>;

  if (message == null) {
    messageFunc = () => Promise.resolve("");
  } else {
    messageFunc = bindRuntimeValueResolver<string, State, Options>(message);
  }

  const checkFunc = async (context: Context<State, Options>) => {
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
    async perform(context: Context<State, Options>) {
      if (await checkFunc(context)) {
        return;
      }

      const message = await messageFunc(context);
      throw new Error(message);
    },
  };
}

export function click<State, Options>(
  selector: RuntimeValue<string, State, Options>
): ClickAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "click",
    selector: selectorFunc,
    async perform(context: Context<State, Options>) {
      const selector = await selectorFunc(context);
      await context.page.click(selector);
    },
  };
}

export function expectUrl<State, Options>(
  url: RuntimeValue<URL | string, State, Options>,
  normalizer?: (input: URL) => string | URL
): ExpectUrlAction<State, Options> {
  const urlFunc = async (context: Context<State, Options>) => {
    const resolved = await resolveRuntimeValue(url, context);
    return resolveURL(resolved, context.options);
  };
  return {
    type: "expect_url",
    url: urlFunc,
    async perform(context) {
      const expected = await urlFunc(context);
      const actual = new URL(context.page.url());

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

export function navigate<State, Options extends unknown | { baseURL: URL }>(
  url: RuntimeValue<string | URL, State, Options>
): NavigateAction<State, Options> {
  const urlFunc = async (context: Context<State, Options>) => {
    const resolved = await resolveRuntimeValue(url, context);
    return resolveURL(resolved, context.options);
  };

  return {
    type: "navigate",
    url: urlFunc,
    async perform(context: Context<State, Options>) {
      const url = await urlFunc(context);
      await context.page.goto(url.toString());
    },
  };
}

export function select<State, Options>(
  selector: RuntimeValue<string, State, Options>,
  value: RuntimeValue<string, State, Options>
): SelectAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const valueFunc = bindRuntimeValueResolver(value);
  return {
    type: "select",
    selector: selectorFunc,
    value: valueFunc,
    async perform(context: Context<State, Options>) {
      const [selector, value] = await Promise.all([
        selectorFunc(context),
        valueFunc(context),
      ]);

      const { page } = context;

      await page.select(selector, value);
    },
  };
}

export function submit<State, Options>(
  selector: RuntimeValue<string, State, Options>
): SubmitAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "submit",
    selector: selectorFunc,
    async perform(context: Context<State, Options>) {
      const selector = await selectorFunc(context);
      const { page } = context;
      await Promise.all([page.click(selector), page.waitForNavigation()]);
      await page.waitForNetworkIdle();
    },
  };
}

export function type<State, Options>(
  selector: RuntimeValue<string, State, Options>,
  value: RuntimeValue<string, State, Options>
): TypeAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const valueFunc = bindRuntimeValueResolver(value);
  return {
    type: "type",
    selector: selectorFunc,
    value: valueFunc,
    async perform(context: Context<State, Options>) {
      const [selector, value] = await Promise.all([
        selectorFunc(context),
        valueFunc(context),
      ]);

      await context.page.type(selector, value);
    },
  };
}

export function upload<State, Options>(
  selector: RuntimeValue<string, State, Options>,
  filename: RuntimeValue<string, State, Options>,
  contents: RuntimeValue<string | Buffer, State, Options>
): UploadAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const filenameFunc = bindRuntimeValueResolver(filename);
  const contentsFunc = bindRuntimeValueResolver(contents);
  return {
    type: "upload",
    selector: selectorFunc,
    filename: filenameFunc,
    contents: contentsFunc,
    async perform(context: Context<State, Options>): Promise<void> {
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

      const { page } = context;

      await page.waitForSelector(selector, { timeout: 3000 });

      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector),
      ]);

      await fileChooser.accept([path.resolve(tempFile)]);
    },
  };
}

async function resolveRuntimeValue<T extends RawValue, State, Options>(
  this: any,
  value: RuntimeValue<T, State, Options>,
  context: Context<State, Options>
): Promise<T> {
  if (typeof value === "function") {
    const result = value(context);
    return result instanceof Promise ? await result : result;
  }
  return value;
}

function bindRuntimeValueResolver<T extends RawValue, State, Options>(
  value: RuntimeValue<T, State, Options>
): (context: Context<State, Options>) => Promise<T> {
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
