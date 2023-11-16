import { NamedCommandEvent, PluginOptions } from "../../types";

export function overAndOverPlugin({ events, state }: PluginOptions) {
  events.on("command", async (event: NamedCommandEvent) => {
    const { command } = event;

    const m = /^(\d+)x$/.exec(command);
    if (!m) {
      return;
    }

    const [commandToRepeat, ...args] = event.args;

    const times = parseInt(m[1], 10);
    for (let i = 0; i < times; i++) {
      await events.emit("command:signout", {
        ...event,
        args: [],
      });

      await events.emit(`command:${commandToRepeat}`, {
        ...event,
        args,
      });
    }
  });
}
