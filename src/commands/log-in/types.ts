import { SpMethod } from "../../types";

export type LogInOptions = {
  baseURL: URL;
  sp?: {
    method: SpMethod;
    url: URL;
  };
};
