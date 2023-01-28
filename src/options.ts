import fs from "node:fs/promises";
import path from "node:path";
import getopts from "getopts";
import { ProgramOptions } from "./types";

export async function resolveOptions(argv: string[]): Promise<ProgramOptions> {
  const options = getopts(argv);
  const environment = options["env"] ?? "local";
  let baseURL: URL;
  let idpRoot: string | undefined;

  switch (environment) {
    case "local":
      baseURL = new URL("http://localhost:3000");
      break;

    case "dev":
      baseURL = new URL("https://idp.dev.identitysandbox.gov");
      break;

    case "int":
      baseURL = new URL("https://idp.int.identitysandbox.gov");
      break;

    default:
      if (/^[a-z0-9_-]$/.test(environment)) {
        baseURL = new URL(`https://idp.${environment}.identitysandbox.gov`);
        break;
      }

      throw new Error(`Invalid value for --env: ${environment}`);
  }

  if (environment === "local") {
    idpRoot = await findIdpRoot();

    if (idpRoot) {
      return {
        baseURL,
        environment,
        idpRoot,
        watchForEmails: true,
      };
    }
  }

  return {
    baseURL,
    environment,
    idpRoot,
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
