import { PluginOptions } from "../../types";

/**
 * Plugin providing a "reset" command.
 */
export function resetPlugin({ events, state }: PluginOptions) {
  events.on("command:reset", async ({ browser }) => {
    await browser.close();
    state.update({
      ...state.current(),
      lastSignup: undefined,
    });
  });
}
