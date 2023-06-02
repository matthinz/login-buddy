import { Request, Response } from "express";
import { CommandEvent, PluginOptions } from "../../../types";
import { randomUUID } from "crypto";

type Options = PluginOptions & {
  publicPath: string;
  toolbarPath: string;
};

const commandHandlers: { [key: string]: string[] } = {
  login: [],
  logout: ["--no-clean-up"],
  signup: [],
};

export function command({
  events,
  programOptions,
  state,
  toolbarPath,
}: Options) {
  return (req: Request, res: Response) => {
    const { command, frame_id: frameId } = req.body;

    const args = commandHandlers[command];

    if (!args) {
      res.sendStatus(400);
      return;
    }

    const event: CommandEvent = {
      args,
      frameId,
      programOptions: {
        ...programOptions,
        // Override baseURL to get it to run through the proxy
        baseURL: new URL(`http://localhost:${programOptions.guiPort}`),
      },
      state,
    };

    events
      .emit(`command:${command}`, event)
      .then(() => {
        res.redirect(`${toolbarPath}?frame_id=${encodeURIComponent(frameId)}`);
      })
      .catch((err) => {
        console.error(err);
        res.sendStatus(500);
      });
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
  state,
}: PluginOptions & {
  commandPath: string;
  publicPath: string;
}) {
  return (req: Request, res: Response) => {
    const { frame_id: frameId } = req.query;
    if (!frameId) {
      res.sendStatus(400);
      return;
    }

    return res.render("toolbar", {
      ...state.current(),
      cacheBuster: Date.now(),
      commandPath,
      frameId,
      publicPath,
    });
  };
}
