import * as dotenv from "dotenv";
import * as plugins from "./plugins";
import { resolveOptions } from "./options";
import { EventBus } from "./events";
import { createState } from "./state";
import { PluginOptions, ProgramOptions } from "./types";
import { BrowserHelper } from "./browser";
import { Browser, launch } from "puppeteer";

dotenv.config();

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(argv: string[]) {
  const programOptions = await resolveOptions(argv);
  const events = new EventBus();
  const state = createState({});
  const browser = new BrowserHelper(createBrowserLauncher(programOptions));

  const pluginOptions: PluginOptions = {
    browser,
    events,
    programOptions,
    state,
  };

  Object.values(plugins).forEach((plugin) => {
    plugin(pluginOptions);
  });
}

function createBrowserLauncher(
  programOptions: ProgramOptions
): () => Promise<Browser> {
  const LAUNCH_OPTIONS = {
    args: [
      programOptions.ignoreSslErrors && "--ignore-certificate-errors",
      programOptions.ignoreSslErrors &&
        `--unsafely-treat-insecure-origin-as-secure="${programOptions.baseURL.toString()}"`,
    ].filter(Boolean) as string[],
    headless: false,
    defaultViewport: null,
  };

  return () => launch(LAUNCH_OPTIONS);
}
