import { CommandExecution } from "./types";

export function makeRunner<Params, State>(
  func: (params: Params, state: State) => Promise<void> | Promise<State>
): (params: Params, state: State) => CommandExecution<State> {
  return function run(params: Params, state: State): CommandExecution<State> {
    let resolve: (state: State) => void;
    let reject: (err: Error) => void;
    let didAbort = false;
    const promise = new Promise<State>((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    const abort = () => {
      didAbort = true;
      reject(new Error("Aborted"));
    };

    func(params, state).then(
      (newState) => {
        resolve(newState ?? state);
      },
      (err) => {
        reject(err);
      }
    );

    return {
      promise,
      abort,
    };
  };
}
