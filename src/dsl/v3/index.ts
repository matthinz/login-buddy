import { Context, Nugget, NuggetProbe } from "./types";

export * from "./probes";

export function createNugget<T>(
  name: string,
  ...probes: NuggetProbe<T>[]
): Nugget<T> {
  return {
    name,
    probe: composeProbes(...probes),
  };
}

interface FluentProbeBuilder {
  atPath<T>(path: string | string[]): NuggetProbe<T> & FluentProbeBuilder;
}
