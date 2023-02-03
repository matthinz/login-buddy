export type SpMethod = "saml" | "oidc";

export type TwoFactorMethod = "sms" | "totp" | "backup_codes";

export type SignupOptions = {
  baseURL: URL;
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
