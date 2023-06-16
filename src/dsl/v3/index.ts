import { Context, Nugget, NuggetProbe } from "./types";

export function createNugget<T>(
  name: string,
  probe: NuggetProbe<T>
): Nugget<T> {
  return {
    name,
    probe,
  };
}

interface FluentProbeBuilder {
  atPath<T>(path: string | string[]): NuggetProbe<T> & FluentProbeBuilder;
}
