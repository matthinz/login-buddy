import { Request, Response } from "express";
import { PluginOptions } from "../../../types";

export function ui({
  publicPath,
  toolbarPath,
}: PluginOptions & { publicPath: string; toolbarPath: string }) {
  return (_req: Request, res: Response) => {
    return res.render("ui", {
      cacheBuster: Date.now(),
      publicPath,
      toolbarPath,
    });
  };
}

/**
 * Creates the toolbar route, which renders controls for the set of actions
 * available to the user.
 */
export function toolbar({
  publicPath,
}: PluginOptions & { publicPath: string }) {
  return (_req: Request, res: Response) => {
    return res.render("toolbar", {
      cacheBuster: Date.now(),
      publicPath,
    });
  };
}
