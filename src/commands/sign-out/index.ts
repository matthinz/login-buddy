import { ensureCurrentPage } from "../../browser";
import { GlobalState } from "../../types";

const REGEX = /^(sign|log)\s*out\b(.*)/i;

export function parse(line: string): {} | undefined {
  const m = REGEX.exec(line);
  if (!m) {
    return;
  }
  return {};
}

export async function run(
  options: {},
  globalState: GlobalState
): Promise<GlobalState> {
  const newGlobalState = await ensureCurrentPage(globalState);
  const { page } = newGlobalState;

  const url = new URL("/logout", globalState.programOptions.baseURL);

  await page.goto(url.toString());

  await page.waitForNetworkIdle();

  await page.deleteCookie({ name: "_identity_idp_session" });

  const message =
    (await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector(".usa-alert--info")?.innerText ?? "";
    })) ?? "";

  if (message) {
    console.error(message);
  }

  await page.close();

  return {
    ...newGlobalState,
    lastSignup: undefined,
    page: undefined,
  };
}

export function runFromUserInput(
  line: string,
  globalState: GlobalState
): Promise<GlobalState> | undefined {
  const options = parse(line);
  if (!options) {
    return;
  }

  return run(options, globalState);
}
