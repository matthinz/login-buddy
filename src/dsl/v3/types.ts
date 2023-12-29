export type PrimitiveType = string | boolean | number;

/**
 * Context captures the immediate...context in which a nugget is being considered.
 */
export interface Context<T> {
  state: T;
  page: Page;
}

/**
 * A Nugget is a small piece of an automation. It runs in two stages.
 * First, call dip(Context). If the nugget can actually _do something_
 * in the current context, it will return a function the caller can then
 * call to perform the relevant action.
 */
export interface Nugget<T> {
  readonly name: string;

  /**
   * Dip is called to see if the nugget applies in the given context.
   * If it applies, dip will return a Promise that will resolve either with:
   *
   *   - Nothing (if the nugget does not apply)
   *   - A function that can be called to apply the nugget
   *
   * The function itself will return a Promise with the updated state.
   * @param context
   */
  dip(context: Context<unknown>): Promise<void | (() => Promise<T>)>;
}

export type DippedNugget<T> = {
  readonly name: string;
  apply(): Promise<T>;
};

export interface Page {
  click(selector: string): Promise<void> & Page;

  /**
   * Clicks the first link on the page that points at the given URL or path.
   * @param urlOrPath
   */
  clickLinkTo(urlOrPath: URL | string): Promise<void> & Page;

  goto(url: URL | string): Promise<void> & Page;
  selectorExists(selector: string): Promise<boolean>;
  setValue(selector: string, value: PrimitiveType): Promise<void> & Page;
  setValues(values: {
    [selector: string]: PrimitiveType;
  }): Promise<void> & Page;
  setValuesByName(values: {
    [name: string]: PrimitiveType;
  }): Promise<void> & Page;
  submit(selector?: string): Promise<void> & Page;
  upload(
    selector: string,
    filename: string,
    contents: string
  ): Promise<void> & Page;
  url(): Promise<URL>;
}
