import { Browser } from "puppeteer";

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

export type SignUpState = {
  email: string;
  password: string;
} & (
  | {
      backupCodes: string[];
      totpCode?: undefined;
    }
  | { backupCodes?: undefined; totpCode: string }
);

export type GlobalState = {
  browser?: Browser;
  lastSignup?: SignUpState | undefined;
  programOptions: ProgramOptions;
};
