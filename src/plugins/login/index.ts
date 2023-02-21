import { EventBus } from "../../events";
import { ProgramOptions } from "../../types";

export function loginPlugin(options: ProgramOptions, events: EventBus) {
  events.on("command:login", () => {});
}
