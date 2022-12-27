import { P, ParsedType } from "p-block";
import { Browser, Page } from "puppeteer";

export type User = {
  email: string;
  password: string;
  backupCodes: string[];
};

export type CommandFunctions = {
  getBrowser: () => Promise<Browser>;
  getPage: () => Promise<Page>;
  getLastSignup: () => User | undefined;
};

export type Command = {
  runFromUserInput(
    input: string,
    functions: CommandFunctions,
    programOptions: ProgramOptions
  ): Promise<void> | undefined;
};

export const ProgramOptionsParser = P.object().withProperties({
  baseURL: P.url().optional(),
  env: P.string().optional(),
});

export type ProgramOptions = ParsedType<typeof ProgramOptionsParser>;
