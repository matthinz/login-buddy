import getopts from "getopts";
import { BrowserHelper } from "../../browser";
import { resolveSpOptions } from "../../sp";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { LOG_IN } from "./flow";
import { LogInOptions } from "./types";
import { Hooks } from "../../hooks";

/**
 * Plugin providing a "login" command.
 */
export function loginPlugin({
  browser,
  events,
  programOptions,
  state,
}: PluginOptions) {
  events.on("command:login", async ({ args }) => {
    const options = parseArgs(args, state.current(), programOptions);
    await login(browser, options, new Hooks(events));
  });
}

async function login(
  browser: BrowserHelper,
  options: LogInOptions,
  hooks: Hooks
): Promise<void> {
  const page = await browser.tryToReusePage(options.baseURL);

  await LOG_IN.run({
    hooks,
    options,
    page,
    state: options.signup,
  });
}

function parseArgs(
  argv: string[],
  { lastSignup }: GlobalState,
  { environment, baseURL }: ProgramOptions
): LogInOptions {
  const raw = getopts(argv);

  const sp = resolveSpOptions(raw, environment, baseURL);

  if (!lastSignup) {
    throw new Error("No current signup.");
  }

  return { baseURL, signup: lastSignup, sp };
}
