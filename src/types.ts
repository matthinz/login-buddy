import { Browser } from "puppeteer";
import { EventBus } from "./events";
import { SignupState } from "./plugins/sign-up";

export type PluginOptions = {
  programOptions: ProgramOptions;
  events: EventBus;
  state: StateManager<GlobalState>;
};

export type Plugin = (programOptions: ProgramOptions, events: EventBus) => void;

export type StateManager<State> = {
  update: (newState: State) => void;
  current: () => State;
};

export type ProgramOptions = Readonly<
  {
    /**
     * URL used to build other login URLS.
     * Defaults to <http://localhost:3000>
     */
    baseURL: URL;

    /**
     * What kind of IDP environment are we working in?
     */
    environment: "local" | "dev" | "int" | string;
  } & (
    | {
        /**
         * (Optional) path to the root of the local IDP install,
         * if we're using a local instance.
         *
         * Specify using IDP_ROOT environment variable.
         */
        idpRoot: string;

        /**
         * Whether to watch the local filesystem for emails written to disk.
         */
        watchForEmails: boolean;
      }
    | {
        idpRoot: undefined;
        watchForEmails: false;
      }
  )
>;

export type GlobalState = {
  browser?: Browser;
  lastSignup?: SignupState;
};

export type SpMethod = "saml" | "oidc";

export type TwoFactorMethod = "sms" | "totp" | "backup_codes";

export type SpOptions = { method: SpMethod; url: URL };

// Events

export type NewBrowserEvent = {
  browser: Browser;
};

export type CommandEvent = {
  args: string[];
  state: GlobalState;
};

export type ErrorEvent = {
  error: any;
};

export type EventHandler<EventType> = (event: EventType) => void;

export type AsyncEventHandler<EventType> = (event: EventType) => Promise<void>;
