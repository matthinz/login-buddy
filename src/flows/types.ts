import { Page } from "puppeteer";

export type FlowItem = {
  name: string;
  url?: string;
  submitSelector?: string;
  run?: (tab: Page, state: Record<string, any>) => Promise<void>;
};

export type Flow = FlowItem[];
