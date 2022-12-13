import { navigateTo } from "./dsl";
import { SIGN_UP_FLOW } from "./sign-up";

export const SP_SIGN_UP_FLOW = navigateTo("http://localhost:9292")
  .expectUrl("/")
  .submit("button[type=submit]")

  .expectUrl("/")
  .submit("form.new_user .usa-button.usa-button--outline")

  .passTo(SIGN_UP_FLOW.skipNavigation())

  .expectUrl("/sign_up/completed")
  .submit();
