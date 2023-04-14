import {
  ClickAction,
  Context,
  EvaluateAction,
  ExpectUrlAction,
  NavigateAction,
  RawValue,
  RuntimeValue,
  SubmitAction,
  TypeAction,
} from "./types";

export function click<State, Options>(
  selector: RuntimeValue<string, State>
): ClickAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "click",
    selector: selectorFunc,
    async perform({ page, state }: Context<State, Options>) {
      const selector = await selectorFunc(state);
      await page.click(selector);
    },
  };
}

export function expectUrl<State, Options>(
  url: RuntimeValue<URL | string, State>
): ExpectUrlAction<State, Options> {
  const urlFunc = async (state: State) => {
    const resolved = await resolveRuntimeValue(url, state);
    return resolved instanceof URL ? resolved : new URL(resolved);
  };
  return {
    type: "expect_url",
    url: urlFunc,
    async perform({ page, state }) {
      const expected = await urlFunc(state);
      const actual = new URL(page.url());
      if (expected.toString() !== actual.toString()) {
        const err: Error & { code?: string } = new Error(
          `Expected URL ${expected.toString()}, but got ${actual.toString()}`
        );
        err.code = "expect_url";
        throw err;
      }
    },
  };
}

export function navigate<State, Options>(
  url: RuntimeValue<string | URL, State>
): NavigateAction<State, Options> {
  const urlFunc = async (state: State) => {
    const resolved = await resolveRuntimeValue(url, state);
    return resolved instanceof URL ? resolved : new URL(resolved);
  };

  return {
    type: "navigate",
    url: urlFunc,
    async perform({ page, state }: Context<State, Options>) {
      const url = await urlFunc(state);
      await page.goto(url.toString());
    },
  };
}

export function submit<State, Options>(
  selector: RuntimeValue<string, State>
): SubmitAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  return {
    type: "submit",
    selector: selectorFunc,
    async perform({ page, state }: Context<State, Options>) {
      const selector = await selectorFunc(state);
      await Promise.all([page.click(selector), page.waitForNavigation()]);
      await page.waitForNetworkIdle();
    },
  };
}

export function type<State, Options>(
  selector: RuntimeValue<string, State>,
  value: RuntimeValue<string, State>
): TypeAction<State, Options> {
  const selectorFunc = bindRuntimeValueResolver(selector);
  const valueFunc = bindRuntimeValueResolver(value);
  return {
    type: "type",
    selector: selectorFunc,
    value: valueFunc,
    async perform({ page, state }: Context<State, Options>) {
      const [selector, value] = await Promise.all([
        selectorFunc(state),
        valueFunc(state),
      ]);

      await page.type(selector, value);
    },
  };
}

async function resolveRuntimeValue<T extends RawValue, State>(
  this: any,
  value: RuntimeValue<T, State>,
  state: State
): Promise<T> {
  if (typeof value === "function") {
    const result = value(state);
    return result instanceof Promise ? await result : result;
  }
  return value;
}

function bindRuntimeValueResolver<T extends RawValue, State>(
  value: RuntimeValue<T, State>
): (state: State) => Promise<T> {
  // TODO: Figure this out.
  // @ts-ignore
  return resolveRuntimeValue.bind(undefined, value);
}
