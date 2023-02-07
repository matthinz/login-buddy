import { SpMethod, SpOptions } from "./types";

const SP_URLS_BY_ENVIRONMENT: { [key: string]: { [key: string]: string } } = {
  local: {
    oidc: "http://localhost:9292", // identity-oidc-sinatra
    saml: "http://localhost:4567", // identity-saml-sinatra
  },
  dev: {
    oidc: "https://dev-identity-oidc-sinatra.app.cloud.gov/",
    saml: "https://dev-identity-saml-sinatra.app.cloud.gov/",
  },
  int: {
    oidc: "https://int-identity-oidc-sinatra.app.cloud.gov/",
    saml: "https://int-identity-saml-sinatra.app.cloud.gov/",
  },
};

export function resolveSpOptions(
  raw: Record<string, string | boolean>,
  environment: string,
  baseURL: URL
): SpOptions | undefined {
  const sp = !!(raw.sp || raw.saml || raw.oidc || raw.spUrl);
  if (!sp) {
    return;
  }

  let method: SpMethod = "oidc";
  let url = raw.spUrl == null ? undefined : new URL(String(raw.spUrl), baseURL);

  if (raw.saml) {
    method = "saml";
  }

  if (!url) {
    const unparsedUrl = (SP_URLS_BY_ENVIRONMENT[environment] ?? {})[method];
    url = unparsedUrl ? new URL(unparsedUrl) : undefined;

    if (!url) {
      throw new Error(
        `Don't know what URL to use for SP ${method} connection in ${environment}. Please specify --sp-url`
      );
    }
  }

  return { method, url };
}
