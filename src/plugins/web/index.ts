import { PluginOptions } from "../../types";
import { createExpressApp } from "./app";

/**
 * Plugin that provides a web interface.
 */
export function webPlugin(options: PluginOptions) {
  const {
    programOptions: { gui, guiPort },
  } = options;

  if (!gui) {
    return;
  }

  const app = createExpressApp(options);

  app.listen(guiPort, () => {
    console.error(`Listening on http://127.0.0.1:${guiPort}`);
  });
}
