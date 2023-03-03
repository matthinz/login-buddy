import { Browser, launch as puppeteerLaunch, Page } from "puppeteer";
import { EventBus } from "./events";
import { GlobalState, NewBrowserEvent, StateManager } from "./types";

const LAUNCH_OPTIONS = {
  headless: false,
  defaultViewport: null,
};

export class BrowserHelper {
  private events: EventBus;
  private stateManager: StateManager<GlobalState>;
  private launchPromise: Promise<Browser> | undefined;

  constructor(events: EventBus, stateManager: StateManager<GlobalState>) {
    this.events = events;
    this.stateManager = stateManager;
  }

  async activePage(): Promise<Page | undefined> {
    const { browser } = this.stateManager.current();
    if (!browser) {
      return;
    }

    const pages = await browser.pages();

    return await pages.reduce<Promise<Page | undefined>>((promise, page) => {
      return promise.then(async (result) => {
        if (result) {
          return result;
        }

        const isVisible = await page.evaluate(
          () => document.visibilityState === "visible"
        );

        if (isVisible) {
          return page;
        }
      });
    }, Promise.resolve(undefined));
  }

  launch(): Promise<Browser> {
    if (this.launchPromise) {
      return this.launchPromise;
    }

    this.launchPromise = Promise.resolve().then(async () => {
      const state = this.stateManager.current();
      if (state.browser) {
        return state.browser;
      }

      const browser = await puppeteerLaunch(LAUNCH_OPTIONS);

      this.stateManager.update({
        ...state,
        browser,
      });

      this.events.emit("newBrowser", { browser });

      return browser;
    });

    return this.launchPromise;
  }

  async newPage(): Promise<Page> {
    const browser = await this.launch();
    return await browser.newPage();
  }
}
