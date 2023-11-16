import {
  AskEvent,
  CommandEvent,
  ErrorEvent,
  EventHandler,
  MessageEvent,
  MessagePreviewAvailableEvent,
  NamedCommandEvent,
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
  emit(eventName: "command", event: NamedCommandEvent): Promise<void>;
  emit(eventName: "ask", event: AskEvent): Promise<void>;
  emit(eventName: "error", event: ErrorEvent): Promise<void>;
  emit(eventName: "message", event: MessageEvent): Promise<void>;
  emit(
    eventName: "messagePreviewAvailable",
    event: MessagePreviewAvailableEvent
  ): Promise<void>;
  emit(eventName: "signup", event: SignupEvent): Promise<void>;
  emit(eventName: "idpConnectionLost"): Promise<void>;
  emit(eventName: "idpConnectionRestored"): Promise<void>;
  async emit<EventType>(eventName: string, event?: EventType): Promise<void> {
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

  on(eventName: "command", handler: EventHandler<NamedCommandEvent>): void;
  on<CommandName extends string>(
    eventName: `command:${CommandName}`,
    handler: EventHandler<CommandEvent>
  ): void;
  on(eventName: "ask", handler: EventHandler<AskEvent>): void;
  on(eventName: "error", handler: EventHandler<ErrorEvent>): void;
  on(eventName: "message", handler: EventHandler<MessageEvent>): void;
  on(
    eventName: "messagePreviewAvailable",
    handler: EventHandler<MessagePreviewAvailableEvent>
  ): void;
  on(eventName: "signup", handler: EventHandler<SignupEvent>): void;
  on(eventName: "idpConnectionLost", handler: () => void): void;
  on(eventName: "idpConnectionRestored", handler: () => void): void;
  on<EventType>(
    eventName: string,
    handler: EventHandler<EventType> | (() => void)
  ): void {
    this.handlersByEvent[eventName] = this.handlersByEvent[eventName] ?? [];
    this.handlersByEvent[eventName].push(handler);
  }
}
