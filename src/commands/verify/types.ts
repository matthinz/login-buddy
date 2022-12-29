import { P, ParsedType } from "p-block";

export const THREATMETRIX_OPTIONS = ["no_result", "pass", "reject", "review"];

export const verifyOptionsParser = P.object()
  .withProperties({
    threatMetrix: P.string().isIn(THREATMETRIX_OPTIONS),
    gpo: P.boolean(),
  })
  .defaultedTo({
    threatMetrix: "no_result",
    gpo: false,
  });

export type VerifyOptions = ParsedType<typeof verifyOptionsParser>;
