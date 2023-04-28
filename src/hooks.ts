import { FlowHooks } from "./dsl/v2/flow-builder/types";
import { EventBus } from "./events";

export class Hooks implements FlowHooks {
  private events: EventBus;
  constructor(events: EventBus) {
    this.events = events;
  }

  ask(prompt: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      let response: string | undefined;
      let eventWasReceived = false;
      let receivedResponse = false;

      const received = () => {
        eventWasReceived = true;
      };

      const respond = (answer: string | undefined) => {
        response = answer;
        receivedResponse = true;
      };

      this.events
        .emit("ask", {
          prompt,
          received,
          respond,
        })
        .then(() => {
          if (!eventWasReceived) {
            reject(new Error("No plugin responded to ask() event."));
          }

          checkForResponse();

          function checkForResponse() {
            if (receivedResponse) {
              resolve(response);
            } else {
              setTimeout(checkForResponse, 100);
            }
          }
        })
        .catch(reject);
    });
  }
}
