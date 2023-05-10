import httpProxy from "http-proxy";
import { Request, Response } from "express";
import { PluginOptions } from "../../../types";

export function idpReverseProxy({ programOptions }: PluginOptions) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: `${programOptions.baseURL}`,
  });

  proxy.on("proxyReq", (proxyReq, req, res) => {});

  proxy.on("proxyRes", (proxyRes, req, res) => {
    if (proxyRes.statusCode) {
      res.statusCode = proxyRes.statusCode;
      if (res.statusMessage) {
        proxyRes.statusMessage = res.statusMessage;
      }
    }

    Object.keys(proxyRes.headers).forEach((header) => {
      const value = proxyRes.headers[header];
      if (value != null) {
        res.setHeader(header, value);
      }
    });

    proxyRes.pipe(res);
  });

  return (req: Request, res: Response) => {
    proxy.web(req, res);
  };
}
