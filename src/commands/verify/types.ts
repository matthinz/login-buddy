import { P, ParsedType } from "p-block";

export const THREATMETRIX_OPTIONS = ["none", "reject", "review", "pass"];

export const optionsParser = P.object()
  .withProperties({
    threatMetrix: P.string().isIn(THREATMETRIX_OPTIONS),
  })
  .defaultedTo({
    threatMetrix: "none",
  });

export type Options = ParsedType<typeof optionsParser>;
