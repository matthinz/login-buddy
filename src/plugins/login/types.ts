import { SpMethod } from "../../types";
import { SignupState } from "../sign-up";

export type LogInOptions = {
  baseURL: URL;
  signup: SignupState;
  sp?: {
    method: SpMethod;
    url: URL;
  };
};
