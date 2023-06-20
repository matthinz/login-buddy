import { Frame } from "puppeteer";

export const THREATMETRIX_RESULTS = [
  "no_result",
  "pass",
  "reject",
  "review",
] as const;

export type ThreatMetrixResult = typeof THREATMETRIX_RESULTS[number];

export type VerifyOptions = {
  badId?: boolean | undefined;
  barcodeReadError: boolean;
  baseURL: URL;
  hybrid: boolean;
  inPerson: boolean;
  mvaTimeout: boolean;
  phone?: string | undefined;
  threatMetrix: ThreatMetrixResult;
  shouldEnterGpoOtp: boolean;
  shouldRequestLetter: boolean;
  throttleGpo: boolean;
  throttlePhone: boolean | undefined;
  throttleSsn: boolean | undefined;
  ssn?: string | undefined;
  until?: string;
  uploadUrl?: URL;
  getLinkToHybridFlow?: () => Promise<string | undefined>;
  getMobileBrowserFrame?: () => Promise<Frame>;
};
