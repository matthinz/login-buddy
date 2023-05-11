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

  const url = `http://localhost:${guiPort}/__login_buddy__/`;

  app.listen(guiPort, () => {
    options.browser.newPage().then((page) => page.goto(url));
  });
}
