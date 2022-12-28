import { P, ParsedType } from "p-block";
import { Browser, Page } from "puppeteer";
import { SignUpState } from "./commands/sign-up";

export type Command = {
  runFromUserInput(
    input: string,
    globalState: GlobalState
  ): Promise<GlobalState> | undefined;
};

export const ProgramOptionsParser = P.object().withProperties({
  baseURL: P.url().optional(),
  env: P.string().optional(),
});

export type ProgramOptions = ParsedType<typeof ProgramOptionsParser>;

export type GlobalState = {
  browser?: Browser;
  lastSignup?: SignUpState | undefined;
  page?: Page;
  programOptions: ProgramOptions;
};
