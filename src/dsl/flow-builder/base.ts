import { ConsoleMessage } from "puppeteer";
import { createFlow } from "..";
import {
  click,
  expectUrl,
  navigate,
  select,
  submit,
  type,
  upload,
} from "./actions";
import {
  Action,
  Context,
  FlowBuilderInterface,
  FlowHooks,
  FlowResult,
  RuntimeValue,
} from "./types";

export abstract class AbstractFlowBuilder<
  InputState extends {},
  State extends InputState,
  Options
> implements FlowBuilderInterface<InputState, State, Options>
{
  branch<TrueState extends State, FalseState extends State>(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, TrueState, Options>,
    ifFalse: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, FalseState, Options>
  ): FlowBuilderInterface<InputState, TrueState | FalseState, Options> {
    return this.deriveAndModifyState(
      async (
        context
      ): Promise<FlowResult<InputState, TrueState | FalseState>> => {
        const checkPasses = await check(context);

        const flow = checkPasses
          ? ifTrue(createFlow(), context)
          : ifFalse(createFlow(), context);

        return flow.run(context);
      }
    );
  }

  click(
    selector: RuntimeValue<string, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(click(selector));
  }

  evaluate<NextState extends State>(
    func: (context: Context<InputState, State, Options>) => Promise<NextState>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return this.deriveAndModifyState(
      async (
        context: Context<InputState, State, Options>
      ): Promise<FlowResult<InputState, NextState>> => {
        function handleConsoleMessage(msg: ConsoleMessage) {
          console.error(msg.text());
        }

        context.frame.page().on("console", handleConsoleMessage);

        try {
          const nextState = await func(context);
          return {
            completed: true,
            state: nextState,
          };
        } finally {
          context.frame.page().off("console", handleConsoleMessage);
        }
      }
    );
  }

  expect(
    url: RuntimeValue<
      string | URL | (string | URL)[],
      InputState,
      State,
      Options
    >,
    normalizer?: (input: URL) => string | URL
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(expectUrl(url, normalizer));
  }

  generate<
    Key extends string,
    Value,
    NextState extends State & { [key in Key]: Value }
  >(
    key: Key,
    generator: (
      context: Context<InputState, State, Options>
    ) => Value | Promise<Value>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return this.deriveAndModifyState(
      async (context: Context<InputState, State, Options>) => {
        const { state } = context;
        if (state && typeof state === "object") {
          if ((state as Record<string, unknown>)[key] != null) {
            // This key is already present, don't need to generate it
            return {
              completed: true,
              state: state as NextState, // XXX: technically state[key] could not be a Value
            };
          }
        }

        const rawValue = generator(context);
        const value = rawValue instanceof Promise ? await rawValue : rawValue;

        const nextState = {
          ...(context.state ?? {}),
          [key]: value,
        } as NextState;

        return {
          completed: true,
          state: nextState,
        };
      }
    );
  }

  navigateTo(
    url: RuntimeValue<string | URL, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(navigate(url));
  }

  abstract run(
    context: Context<InputState, InputState, Options>
  ): Promise<FlowResult<InputState, State>>;

  select(
    selector: RuntimeValue<string, InputState, State, Options>,
    value: RuntimeValue<string, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(select(selector, value));
  }

  submit(
    selector?: RuntimeValue<string, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(submit(selector ?? "form button[type=submit]"));
  }

  then<NextState extends State>(
    next: (
      flow: FlowBuilderInterface<InputState, State, Options>
    ) => FlowBuilderInterface<InputState, NextState, Options>
  ): FlowBuilderInterface<InputState, NextState, Options> {
    return next(this);
  }

  type(
    selector: RuntimeValue<string, InputState, State, Options>,
    value: RuntimeValue<string | number, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(type(selector, value));
  }

  upload(
    selector: RuntimeValue<string, InputState, State, Options>,
    filename: RuntimeValue<string, InputState, State, Options>,
    contents: RuntimeValue<string, InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options> {
    return this.derive(upload(selector, filename, contents));
  }

  waitUntil(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>
  ): FlowBuilderInterface<InputState, State, Options> {
    const POLL_INTERVAL = 300;

    return this.deriveAndModifyState(
      (context) =>
        new Promise((resolve, reject) => {
          doCheck();

          async function doCheck() {
            let checkPassed;

            try {
              checkPassed = await check(context);
            } catch (err: any) {
              const canIgnore = err.message.includes(
                "Execution context was destroyed"
              );
              if (!canIgnore) {
                reject(err);
                return;
              }
            }

            if (checkPassed) {
              resolve({
                completed: true,
                state: context.state,
              });
              return;
            }

            setTimeout(doCheck, POLL_INTERVAL);
          }
        })
    );
  }

  when<NextState extends State>(
    check: (
      context: Context<InputState, State, Options>
    ) => boolean | void | Promise<boolean | void>,
    ifTrue: (
      flow: FlowBuilderInterface<State, State, Options>,
      context: Context<InputState, State, Options>
    ) => FlowBuilderInterface<State, NextState, Options>
  ): FlowBuilderInterface<InputState, State | NextState, Options> {
    return this.branch(check, ifTrue, (flow) => flow);
  }

  protected abstract derive(
    action: Action<InputState, State, Options>
  ): FlowBuilderInterface<InputState, State, Options>;

  protected abstract deriveAndModifyState<NextState extends State>(
    converter: (
      context: Context<InputState, State, Options>
    ) => Promise<FlowResult<InputState, NextState>>
  ): FlowBuilderInterface<InputState, NextState, Options>;
}
