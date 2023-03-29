export const THREATMETRIX_RESULTS = [
  "no_result",
  "pass",
  "reject",
  "review",
] as const;

export type ThreatMetrixResult = typeof THREATMETRIX_RESULTS[number];

export type VerifyOptions = {
  baseURL: URL;
  gpo: boolean;
  hybrid: boolean;
  phone?: string | undefined;
  threatMetrix: ThreatMetrixResult;
  throttlePhone?: boolean | undefined;
  ssn?: string | undefined;
  until?: string;
};
