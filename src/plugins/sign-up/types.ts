import { BrowserHelper } from "../../browser";

export type SpMethod = "saml" | "oidc";

export type TwoFactorMethod = "sms" | "totp" | "backup_codes";

export type SignupOptions = {
  baseURL: URL;

  /**
   * Email address used to generate addresses for new accounts.
   */
  baseEmail: string;

  /**
   * Phone number used to generate new phone numbers.
   */
  basePhone: string;

  alsoVerify: boolean;

  sp?: {
    method: SpMethod;
    url: URL;
  };
  twoFactor: TwoFactorMethod;
  until?: string;
};

export type SignupState = {
  email: string;
  password: string;
  phone?: string;
  totpCode?: string;
  backupCodes?: string[];
};
