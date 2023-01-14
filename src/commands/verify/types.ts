import { P, ParsedType } from "p-block";

export const THREATMETRIX_OPTIONS = ["no_result", "pass", "reject", "review"];

export const verifyParametersParser = P.object()
  .withProperties({
    threatMetrix: P.string().isIn(THREATMETRIX_OPTIONS),
    gpo: P.boolean(),
    until: P.string().optional(),
  })
  .defaultedTo({
    threatMetrix: "no_result",
    gpo: false,
  });

export type VerifyParameters = ParsedType<typeof verifyParametersParser>;
