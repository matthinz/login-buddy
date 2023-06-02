import getopts from "getopts";
import { resolveSpOptions } from "../../sp";
import { GlobalState, PluginOptions, ProgramOptions } from "../../types";
import { LOG_IN } from "./flow";
import { LogInOptions } from "./types";
import { Frame } from "puppeteer";

/**
 * Plugin providing a "login" command.
 */
export function loginPlugin({
  browser,
  events,
  programOptions,
  state,
}: PluginOptions) {
  events.on("command:login", async ({ args, frameId }) => {
    const options = parseArgs(args, state.current(), programOptions);
    const frame =
      (await browser.getFrameById(frameId)) ??
      (await browser.tryToReusePage(options.baseURL)).mainFrame();

    await login(options, frame);

    state.update({
      ...state.current(),
      loggedIn: true,
    });
  });
}

async function login(options: LogInOptions, frame: Frame): Promise<void> {
  await LOG_IN.run({
    options,
    frame,
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
