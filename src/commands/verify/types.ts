export const THREATMETRIX_RESULTS = [
  "no_result",
  "pass",
  "reject",
  "review",
] as const;

export type ThreatMetrixResult = typeof THREATMETRIX_RESULTS[number];

export type VerifyOptions = {
  baseURL: URL;
  hybrid: boolean;
  threatMetrix: ThreatMetrixResult;
  gpo: boolean;
  until?: string;
};
