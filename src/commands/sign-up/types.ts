import { P, ParsedType } from "p-block";

export const signupParametersParser = P.object().withProperties({
  sp: P.boolean().defaultedTo(false),
  spUrl: P.url().optional(),
  until: P.string().optional(),
});

export type SignupParameters = ParsedType<typeof signupParametersParser>;
