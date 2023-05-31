import { Frame } from "puppeteer";
import { BrowserHelper } from "./browser";
import { EventBus } from "./events";
import { SignupState } from "./plugins/sign-up";

export type PluginOptions = {
  browser: BrowserHelper;
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
     * Base email address used when creating account.
     */
    baseEmail: string;

    /**
     * Base phone number used to generate new phone numbers.
     */
    basePhone: string;

    /**
     * URL used to build other login URLS.
     * Defaults to <http://localhost:3000>
     */
    baseURL: URL;

    /**
     * Whether or not to expose a GUI.
     */
    gui: boolean;

    /**
     * Port to serve the GUI from. Defaults to 3001.
     */
    guiPort: number;

    /**
     * What kind of IDP environment are we working in?
     */
    environment: "local" | "dev" | "int" | string;

    /**
     * Whether to ignore issues with SSL certs.
     */
    ignoreSslErrors: boolean;
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
  lastSignup?: SignupState;
  loggedIn: boolean;
};

export type SpMethod = "saml" | "oidc";

export type TwoFactorMethod = "sms" | "totp" | "backup_codes";

export type SpOptions = { method: SpMethod; url: URL };

export type TelephonyMessage = {
  type: "voice" | "sms";
  time: Date;
  to: string[];
  body: string;
};

export type EmailMessage = {
  type: "email";
  time: Date;
  to: string[];
  subject: string;
  body: string;
  htmlBody: string;
};

export type Message = TelephonyMessage | EmailMessage;

// Events

export type AskEvent = {
  prompt: string;
  received: () => void;
  respond: (answer: string | undefined) => void;
};

export type CommandEvent = {
  args: string[];
  frameId?: string;
  programOptions: ProgramOptions;
  state: StateManager<GlobalState>;
};

export type ErrorEvent = {
  error: any;
};

export type MessageEvent = {
  message: Message;
};

export type SignupEvent = {
  signup: SignupState;
};

export type EventHandler<EventType> = (
  event: EventType
) => void | Promise<void>;
