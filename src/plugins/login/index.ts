import getopts from "getopts";
import { BrowserHelper } from "../../browser-helper";
import { EventBus } from "../../events";
import { resolveSpOptions } from "../../sp";
import { ProgramOptions } from "../../types";
import { LogInOptions } from "./types";

/**
 * Plugin providing a "login" command.
 */
export function loginPlugin(
  programOptions: ProgramOptions,
  events: EventBus,
  browser: BrowserHelper
) {
  events.on("command:login", ({ argv }) => {
    const options = parseArgv(argv, programOptions);
  });
}

function parseArgv(
  argv: string[],
  { environment, baseURL }: ProgramOptions
): LogInOptions {
  const raw = getopts(argv);

  const sp = resolveSpOptions(raw, environment, baseURL);

  return { baseURL, sp };
}
