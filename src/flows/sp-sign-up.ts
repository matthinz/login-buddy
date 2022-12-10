import { SIGN_UP_FLOW } from "./sign-up";
import { Flow } from "./types";

export const SP_SIGN_UP_FLOW: Flow = [
  {
    name: "Oidc Sinatra",
    url: "http://localhost:9292",
    submitSelector: "button[type=submit]",
  },
  {
    name: "Login",
    submitSelector: "form.new_user .usa-button.usa-button--outline",
  },
  ...SIGN_UP_FLOW,
  {
    name: "Agree and continue",
    submitSelector: "button[type=submit]",
  },
];
