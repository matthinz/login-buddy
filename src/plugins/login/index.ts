import getopts from "getopts";
import { BrowserHelper } from "../../browser";
import { resolveSpOptions } from "../../sp";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { LOG_IN } from "./flow";
import { LogInOptions } from "./types";

/**
 * Plugin providing a "login" command.
 */
export function loginPlugin({ events, programOptions, state }: PluginOptions) {
  events.on("command:login", async ({ args, browser }) => {
    const options = parseArgs(args, state.current(), programOptions);
    await login(browser, options);
  });
}

async function login(
  browser: BrowserHelper,
  options: LogInOptions
): Promise<void> {
  const page = await browser.newPage();

  await LOG_IN.run(options.signup, {
    ...options,
    page,
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