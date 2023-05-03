import { PluginOptions } from "../../types";

/**
 * Plugin providing a "reset" command.
 */
export function resetPlugin({ browser, events, state }: PluginOptions) {
  events.on("command:reset", async () => {
    await browser.close();
    state.update({
      ...state.current(),
      lastSignup: undefined,
    });
  });
}
