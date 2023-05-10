import express, { Express } from "express";
import path from "node:path";
import { idpReverseProxy } from "./routes/idp";
import { toolbar, ui } from "./routes/ui";
import { PluginOptions } from "../../types";

const PATH_PREFIX = "/__login_buddy__";

export function createExpressApp(options: PluginOptions): Express {
  const publicPath = `${PATH_PREFIX}/public`;
  const app = express();

  app.set("view engine", "pug");
  app.set("views", path.join(__dirname, "views"));

  app.use(publicPath, express.static(path.join(__dirname, "public")));

  app.get(
    `${PATH_PREFIX}/`,
    ui({
      ...options,
      toolbarPath: `${PATH_PREFIX}/toolbar`,
      publicPath,
    })
  );

  app.get(
    `${PATH_PREFIX}/toolbar`,
    toolbar({
      ...options,
      publicPath,
    })
  );

  // Reverse proxy to IDP at '/'
  app.use(idpReverseProxy(options));

  return app;
}
