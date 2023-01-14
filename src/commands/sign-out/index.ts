import { ensureCurrentPage } from "../../browser";
import { GlobalState } from "../../types";
import { makeRunner } from "../utils";

type SignOutParameters = {};

const ALIASES = ["signout", "logout"];

export function parse(args: string[]): SignOutParameters | undefined {
  const cmd = args.shift();
  if (cmd == null || !ALIASES.includes(cmd)) {
    return;
  }
  return {};
}

export const run = makeRunner(
  async (params: SignOutParameters, globalState: GlobalState) => {
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
);
