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
    functions: CommandFunctions
  ): Promise<void> | undefined;
};
