import { Request, Response } from "express";
import { CommandEvent, PluginOptions } from "../../../types";
import { randomUUID } from "crypto";

type Options = PluginOptions & {
  publicPath: string;
  toolbarPath: string;
};

export function command({
  events,
  programOptions,
  state,
  toolbarPath,
}: Options) {
  return (req: Request, res: Response) => {
    const { action, frame_id: frameId } = req.body;

    if (action === "sign-up") {
      const event: CommandEvent = {
        args: [],
        frameId,
        programOptions: {
          ...programOptions,
          // Override baseURL to get it to run through the proxy
          baseURL: new URL(`http://localhost:${programOptions.guiPort}`),
        },
        state,
      };
      events.emit("command:signup", event);
    }

    res.redirect(`${toolbarPath}?frame_id=${encodeURIComponent(frameId)}`);
  };
}

export function ui({ publicPath, toolbarPath }: Options) {
  return (_req: Request, res: Response) => {
    return res.render("ui", {
      cacheBuster: Date.now(),
      publicPath,
      toolbarPath,
      frameId: randomUUID(),
    });
  };
}

/**
 * Creates the toolbar route, which renders controls for the set of actions
 * available to the user.
 */
export function toolbar({
  commandPath,
  publicPath,
}: PluginOptions & { commandPath: string; publicPath: string }) {
  return (req: Request, res: Response) => {
    const { frame_id: frameId } = req.query;
    if (!frameId) {
      res.sendStatus(400);
      return;
    }

    return res.render("toolbar", {
      cacheBuster: Date.now(),
      commandPath,
      frameId,
      publicPath,
    });
  };
}
