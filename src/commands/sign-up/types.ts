import { P, ParsedType } from "p-block";

export const signupOptionsParser = P.object().withProperties({
  sp: P.boolean().defaultedTo(false),
  spUrl: P.url().optional(),
});

export type SignupOptions = ParsedType<typeof signupOptionsParser>;
