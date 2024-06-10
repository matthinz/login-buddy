export interface Context<T> {
  state: T;
  page: Page;
}

/**
 * A NuggetProbe is a little bit of code that runs to see if the nugget is
 * relevant. If it is, it returns a function.
 */
export type NuggetProbe<T> = (
  context: Context<T>
) => Promise<(() => Promise<void>) | void>;

export type FluentNuggetProbe<T> = {
  (context: Context<T>): Promise<(() => Promise<void>) | void>;
};
/**
 * A Nugget is a small piece of an automation. It runs in two stages.
 * First, call probe(Context). If the nugget can actually _do something_
 * in the current context, it will return a function the caller can then
 * call to perform the relevant action.
 */
export interface Nugget<T> {
  readonly name: string;
  probe: NuggetProbe<T>;
}

export interface FluentProbeBuilder<T> {
  (context: Context<T>): Promise<(() => Promise<void>) | void>;
  at(url: string | URL): FluentProbeBuilder<T>;
  selectorExists(selector: string): FluentProbeBuilder<T>;
  stateIncludes<TKey extends string>(
    key: TKey
  ): FluentProbeBuilder<T & { [key in TKey]: unknown }>;
}

export interface Page {
  click(selector: string): Promise<void> & Page;
  goto(url: URL | string): Promise<void> & Page;
  selectorExists(selector: string): Promise<boolean>;
  setValue(selector: string, value: string | number): Promise<void> & Page;
  setValues(values: {
    [selector: string]: string | number;
  }): Promise<void> & Page;
  submit(selector?: string): Promise<void> & Page;
  upload(
    selector: string,
    filename: string,
    contents: string
  ): Promise<void> & Page;
  url(): Promise<URL>;
}
