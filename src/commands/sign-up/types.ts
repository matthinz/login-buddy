import { P, ParsedType } from "p-block";
import { FlowRunOptions } from "../../dsl";

export const signupOptionsParser = P.object().withProperties({
  sp: P.boolean().defaultedTo(false),
  saml: P.boolean().defaultedTo(false),
  spUrl: P.url().optional(),
  until: P.string().optional(),
  useBackupCodes: P.boolean().defaultedTo(false),
});

export type SignupOptions = ParsedType<typeof signupOptionsParser> &
  Omit<FlowRunOptions, "page">;
