import { Context, Nugget, PrimitiveType } from "./types";

function isPrimitive(value: unknown): value is PrimitiveType {
  return ["string", "number", "boolean"].includes(typeof value);
}

type CheckFunction<T> = (context: Context<T>) => Promise<boolean> | boolean;

type CallbackFunction<TIn, TOut extends TIn> = (
  context: Context<TIn>
) => Promise<TOut>;

export class NuggetBuilder<TParent, T extends TParent> implements Nugget<T> {
  readonly #name: string;
  readonly #parent: Nugget<TParent> | undefined;
  readonly #check: CheckFunction<TParent> | undefined;
  readonly #callback: CallbackFunction<TParent, T> | undefined;

  constructor(name: string);
  constructor(name: string, parent: Nugget<TParent>);
  constructor(
    name: string,
    parent: Nugget<TParent>,
    check: CheckFunction<TParent>
  );
  constructor(
    name: string,
    parent: Nugget<TParent>,
    check: undefined,
    callback: CallbackFunction<TParent, T>
  );
  constructor(
    name: string,
    parent?: Nugget<TParent> | undefined,
    check?: CheckFunction<TParent> | undefined,
    callback?: CallbackFunction<TParent, T> | undefined
  ) {
    this.#name = name;
    this.#parent = parent;
    this.#check = check;
    this.#callback = callback;
  }

  get name(): string {
    return this.#name;
  }

  async dip(context: Context<unknown>): Promise<void | (() => Promise<T>)> {
    let parentDipResult: (() => Promise<TParent>) | void;

    if (this.#parent) {
      parentDipResult = await this.#parent.dip(context);
      if (!parentDipResult) {
        return;
      }
    }

    // We know context is at least a Context<TParent>
    const parentApprovedContext = context as Context<TParent>;

    if (this.#check) {
      const checkResult = await this.#check(parentApprovedContext);
      if (!checkResult) {
        return;
      }
    }

    return async (): Promise<T> => {
      if (parentDipResult) {
        const nextStateFromParent = await parentDipResult();

        if (!this.#callback) {
          return nextStateFromParent as T;
        }

        const updatedContext: Context<TParent> = {
          ...context,
          state: nextStateFromParent,
        };

        return this.#callback(updatedContext);
      } else {
        // No parent state to worry about
        if (!this.#callback) {
          return context.state as T;
        }

        return this.#callback(context as Context<TParent>);
      }
    };
  }

  then(callback: (context: Context<T>) => Promise<void>): NuggetBuilder<T, T> {
    const returningCallback = async (context: Context<T>) => {
      await callback.call(this, context);
      return context.state;
    };
    return new NuggetBuilder("callback", this, undefined, returningCallback);
  }

  toString(): string {
    return this.name;
  }

  when(check: CheckFunction<T>): NuggetBuilder<T, T> {
    return new NuggetBuilder("when", this, check);
  }

  whenAtPath(path: string | string[]): NuggetBuilder<T, T> {
    const name = `whenAtPath(${JSON.stringify(path)})`;
    return new NuggetBuilder(name, this, async ({ page }) => {
      const url = await page.url();
      const paths = Array.isArray(path) ? path : [path];
      const result = paths.some((path) => url.pathname == path);
      return result;
    });
  }

  whenSelectorFound(selector: string): NuggetBuilder<T, T> {
    const name = `whenSelectorFound(${JSON.stringify(selector)})`;
    return new NuggetBuilder(name, this, async ({ page }) => {
      return page.selectorExists(selector);
    });
  }

  whenSelectorNotFound(selector: string): NuggetBuilder<T, T> {
    const name = `whenSelectorNotFound(${JSON.stringify(selector)})`;
    return new NuggetBuilder(name, this, async ({ page }) => {
      const exists = await page.selectorExists(selector);
      return !exists;
    });
  }

  whenStateIncludes<Keys extends string[]>(
    ...keys: Keys
  ): NuggetBuilder<T, T & { [key in Keys[number]]: PrimitiveType }> {
    const name = `whenStateIncludes(${JSON.stringify(keys)})`;
    return new NuggetBuilder<T, T & { [key in Keys[number]]: PrimitiveType }>(
      name,
      this,
      ({ state }) => {
        return keys.every((key) => {
          if (!state) {
            return false;
          }
          if (typeof state !== "object") {
            return false;
          }
          const result = isPrimitive((state as Record<string, unknown>)[key]);
          return result;
        });
      }
    );
  }
}

function merge<T1, T2>(a: T1, b: T2): T1 & T2 {
  if (a == null && b == null) {
    return a as T1 & T2;
  } else if (a == null) {
    return b as T1 & T2;
  } else if (b == null) {
    return b as T1 & T2;
  } else if (typeof a === "object" && typeof b === "object") {
    return Object.assign({}, a, b) as T1 & T2;
  } else {
    throw new Error(`Can't merge ${a} and ${b}`);
  }
}
