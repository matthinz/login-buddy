import { at, createNugget, selectorFound, stateIncludes } from "../../dsl/v3";

export const ClickCreateAnAccount = createNugget(
  "click_create_an_account",
  at("/", async (context) => {
    await context.page.click("Create an account");
  })
);

export const EnterEmailAddress = createNugget(
  "enter_email_address",
  stateIncludes("email")
);
