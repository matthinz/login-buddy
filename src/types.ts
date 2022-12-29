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
  baseURL: P.url().defaultedTo(new URL("http://localhost:3000")),
  env: P.string().optional(),
  spUrl: P.url().optional(),
});

export type ProgramOptions = ParsedType<typeof ProgramOptionsParser>;

export type GlobalState = {
  browser?: Browser;
  lastSignup?: SignUpState | undefined;
  page?: Page;
  programOptions: ProgramOptions;
};
