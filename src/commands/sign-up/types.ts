import { P, ParsedType } from "p-block";

export const signupParametersParser = P.object().withProperties({
  sp: P.boolean().defaultedTo(false),
  saml: P.boolean().defaultedTo(false),
  spUrl: P.url().optional(),
  until: P.string().optional(),
  useBackupCodes: P.boolean().defaultedTo(false),
});

export type SignupParameters = ParsedType<typeof signupParametersParser>;
