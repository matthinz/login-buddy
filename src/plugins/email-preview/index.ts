import http from "node:http";
import express, { Express } from "express";
import { EmailMessage, Message, PluginOptions } from "../../types";

const emailMessagesByUUID = new Map<string, EmailMessage>();

export function emailPreviewPlugin({ browser, events }: PluginOptions) {
  const app = createExpressApp();

  const server = http.createServer(app);
  let port: number | undefined;
  server.listen(() => {
    const addr = server.address();
    if (addr && typeof addr !== "string") {
      port = addr.port;
    }
  });

  events.on("message", async ({ message }) => {
    if (message.type !== "email") {
      return;
    }
    const id = crypto.randomUUID();
    emailMessagesByUUID.set(id, message);

    const url = new URL(`http://localhost:${port}/emails/${id}`);

    process.nextTick(() => {
      events.emit("messagePreviewAvailable", {
        message,
        url,
      });
    });
  });
}

function createExpressApp() {
  const app = express();
  app.get("/emails/:id", (req, res) => {
    const message = emailMessagesByUUID.get(req.params.id);
    if (!message) {
      res.status(404);
      res.end();
      return;
    }

    res.contentType("text/html");
    res.send(message.htmlBody);
  });

  return app;
}
