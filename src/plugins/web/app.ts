import express, { Express } from "express";
import path from "node:path";
import { idpReverseProxy } from "./routes/idp";
import { command, toolbar, ui } from "./routes/ui";
import { PluginOptions } from "../../types";

const PATH_PREFIX = "/__login_buddy__";

export function createExpressApp(options: PluginOptions): Express {
  const app = express();

  const commandPath = `${PATH_PREFIX}/command`;
  const publicPath = `${PATH_PREFIX}/public`;
  const toolbarPath = `${PATH_PREFIX}/toolbar`;

  app.set("view engine", "pug");
  app.set("views", path.join(__dirname, "views"));

  app.use(publicPath, express.static(path.join(__dirname, "public")));

  app.get(
    `${PATH_PREFIX}/`,
    ui({
      ...options,
      toolbarPath,
      publicPath,
    })
  );

  app.get(
    `${PATH_PREFIX}/toolbar`,
    toolbar({
      ...options,
      publicPath,
      commandPath,
    })
  );

  // NOTE: Don't include urlencoded middleware on paths that are reverse-proxied
  //       as it will mess up the proxy bits.
  app.use(`${PATH_PREFIX}/command`, express.urlencoded({ extended: true }));

  app.post(
    `${PATH_PREFIX}/command`,
    command({
      ...options,
      toolbarPath,
      publicPath,
    })
  );

  // Reverse proxy to IDP at '/'
  app.use(idpReverseProxy(options));

  return app;
}
