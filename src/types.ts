import { Browser } from "puppeteer";
import { SignupState } from "./commands/sign-up";

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
  programOptions: ProgramOptions;
};

export type SpMethod = "saml" | "oidc";

export type TwoFactorMethod = "sms" | "totp" | "backup_codes";

export type SpOptions = { method: SpMethod; url: URL };
