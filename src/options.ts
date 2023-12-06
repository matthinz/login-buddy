import fs from "node:fs/promises";
import path from "node:path";
import getopts from "getopts";
import { ProgramOptions } from "./types";

const DEFAULT_BASE_EMAIL = "test@example.org";
const DEFAULT_BASE_PHONE = "3602345678";

export async function resolveOptions(argv: string[]): Promise<ProgramOptions> {
  const options = getopts(argv, {
    boolean: ["gui"],
    alias: {
      guiPort: ["gui-port"],
    },
  });
  const environment = options["env"] ?? "local";
  let baseURL: URL;
  let idpRoot: string | undefined;
  let ignoreSslErrors = false;

  switch (environment) {
    case "local":
      if (options.host) {
        baseURL = new URL(`https://${options.host}:3000`);
        ignoreSslErrors = true;
      } else {
        baseURL = new URL("http://localhost:3000");
      }
      break;

    case "dev":
      baseURL = new URL("https://idp.dev.identitysandbox.gov");
      break;

    case "int":
      baseURL = new URL("https://idp.int.identitysandbox.gov");
      break;

    default:
      if (/^[a-z0-9_-]+$/.test(environment)) {
        baseURL = new URL(`https://idp.${environment}.identitysandbox.gov`);
        break;
      }

      // Allow passing a URL in as environment
      try {
        baseURL = new URL(environment);
        break;
      } catch (err) {}

      throw new Error(`Invalid value for --env: ${environment}`);
  }

  const baseEmail = String(
    options.email ?? process.env["LOGIN_BUDDY_EMAIL"] ?? DEFAULT_BASE_EMAIL
  );
  const basePhone = String(
    options.phone ?? process.env["LOGIN_BUDDY_PHONE"] ?? DEFAULT_BASE_PHONE
  );

  const gui = !!options.gui;

  let guiPort = options.guiPort == null ? parseInt(options.guiPort, 10) : NaN;
  guiPort = isNaN(guiPort) ? 3001 : guiPort;

  if (environment === "local") {
    idpRoot = await findIdpRoot();

    if (idpRoot) {
      return {
        baseURL,
        baseEmail,
        basePhone,
        environment,
        gui,
        guiPort,
        idpRoot,
        ignoreSslErrors,
        watchForEmails: true,
      };
    }
  }

  return {
    baseURL,
    baseEmail,
    basePhone,
    environment,
    gui,
    guiPort,
    idpRoot,
    ignoreSslErrors: false,
    watchForEmails: false,
  };
}

async function findIdpRoot(): Promise<string | undefined> {
  const idpRoot = (process.env.IDP_ROOT ?? "").trim();

  if (idpRoot.length === 0) {
    return;
  }

  try {
    const stat = await fs.stat(idpRoot);
    if (!stat.isDirectory()) {
      throw new Error("Not a directory");
    }
    return path.resolve(idpRoot);
  } catch (err: any) {
    throw new Error(`Error reading IDP_ROOT: ${err.message}`);
  }
}
