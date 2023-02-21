import { EventEmitter } from "node:events";
import { Browser } from "puppeteer";

type BrowserEvent = {
  browser: Browser;
};

type CommandEvent = {
  argv: string[];
};

type ErrorEvent = {
  error: any;
};

type Handler<EventType> = (event: EventType) => void;

type AsyncHandler<EventType> = (event: EventType) => Promise<void>;

/**
 * 🚌
 */
export class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  emit(eventName: "newBrowser", event: BrowserEvent): void;
  emit(eventName: "error", event: ErrorEvent): void;
  emit<EventType>(eventName: string, event: EventType) {
    this.emitter.emit(eventName, event);
  }

  on(eventName: "newBrowser", handler: Handler<BrowserEvent>): void;
  on<CommandName extends string>(
    eventName: `command:${CommandName}`,
    handler: Handler<CommandEvent> | AsyncHandler<CommandEvent>
  ): void;
  on<EventType>(
    eventName: string,
    handler: Handler<EventType> | AsyncHandler<EventType>
  ): void {
    this.emitter.on(eventName, (event: EventType) => {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch((err) => {
          this.emit("error", err);
        });
      }
    });
  }
}
