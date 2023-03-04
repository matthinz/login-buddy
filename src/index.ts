import * as dotenv from "dotenv";
import * as plugins from "./plugins";
import { resolveOptions } from "./options";
import { EventBus } from "./events";
import { createState } from "./state";

dotenv.config();

run(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(argv: string[]) {
  const programOptions = await resolveOptions(argv);
  const events = new EventBus();
  const state = createState({});

  Object.values(plugins).forEach((plugin) => {
    plugin({ programOptions, events, state });
  });
}
