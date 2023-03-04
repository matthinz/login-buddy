import {
  CommandEvent,
  ErrorEvent,
  EventHandler,
  MessageEvent,
  NewBrowserEvent,
  SignupEvent,
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
  emit(eventName: "error", event: ErrorEvent): Promise<void>;
  emit(eventName: "message", event: MessageEvent): Promise<void>;
  emit(eventName: "newBrowser", event: NewBrowserEvent): Promise<void>;
  emit(eventName: "signup", event: SignupEvent): Promise<void>;
  async emit<EventType>(eventName: string, event: EventType): Promise<void> {
    const handlers = this.handlersByEvent[eventName];
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        await this.emit("error", { error });
      }
    }
  }

  on<CommandName extends string>(
    eventName: `command:${CommandName}`,
    handler: EventHandler<CommandEvent>
  ): void;
  on(eventName: "error", handler: EventHandler<ErrorEvent>): void;
  on(eventName: "message", handler: EventHandler<MessageEvent>): void;
  on(eventName: "newBrowser", handler: EventHandler<NewBrowserEvent>): void;
  on(eventName: "signup", handler: EventHandler<SignupEvent>): void;
  on<EventType>(eventName: string, handler: EventHandler<EventType>): void {
    this.handlersByEvent[eventName] = this.handlersByEvent[eventName] ?? [];
    this.handlersByEvent[eventName].push(handler);
  }
}
