import {
  AsyncEventHandler,
  CommandEvent,
  EventHandler,
  NewBrowserEvent,
} from "./types";

/**
 * 🚌
 */
export class EventBus {
  private handlersByEvent: {
    [key: string]: ((...args: any[]) => void | Promise<void>)[];
  } = {};

  emit<CommandName extends string>(
    eventName: `command:${CommandName}`,
    event: CommandEvent
  ): Promise<void>;
  emit(eventName: "newBrowser", event: NewBrowserEvent): Promise<void>;
  emit(eventName: "error", event: ErrorEvent): Promise<void>;
  async emit<EventType>(eventName: string, event: EventType): Promise<void> {
    const handlers = this.handlersByEvent[eventName];
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      const result = handler(event);
      if (result instanceof Promise) {
        await result;
      }
    }
  }

  on(eventName: "newBrowser", handler: EventHandler<NewBrowserEvent>): void;
  on<CommandName extends string>(
    eventName: `command:${CommandName}`,
    handler: EventHandler<CommandEvent> | AsyncEventHandler<CommandEvent>
  ): void;
  on(
    eventName: "error",
    handler: EventHandler<ErrorEvent> | AsyncEventHandler<ErrorEvent>
  ): void;
  on<EventType>(
    eventName: string,
    handler: EventHandler<EventType> | AsyncEventHandler<EventType>
  ): void {
    this.handlersByEvent[eventName] = this.handlersByEvent[eventName] ?? [];
    this.handlersByEvent[eventName].push(handler);
  }
}
