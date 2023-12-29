import { NuggetBuilder } from "../../dsl/v3/nugget-builder";

export const CHOOSE_CREATE_AN_ACCOUNT = new NuggetBuilder(
  "choose_create_an_account"
)
  .whenAtPath("/")
  .whenStateIncludes("email")
  .then(({ page }) => page.clickLinkTo("/sign_up/enter_email"));

export const SIGN_UP = new NuggetBuilder("sign_up")
  .whenAtPath("/sign_up/enter_email")
  .whenStateIncludes("email")
  .then(({ page, state: { email } }) =>
    page
      .setValuesByName({
        "user[email]": email,
        "user[terms_accepted]": true,
      })
      .submit()
  );

export const CONFIRM_EMAIL_IN_LOAD_TESTING_MODE = new NuggetBuilder(
  "confirm_email_in_load_testing_mode"
)
  .whenAtPath("/sign_up/verify_email")
  .whenSelectorFound("#confirm-now")
  .then(({ page }) => page.click("#confirm-now"));

export const CONFIRM_EMAIL = new NuggetBuilder("confirm_email")
  .whenAtPath("/sign_up/verify_email")
  .whenSelectorNotFound("#confirm-now")
  .whenStateIncludes("confirmEmailToken")
  .then(({ page, state: { confirmEmailToken } }) =>
    page.goto(
      `/sign_up/email/confirm?confirmation_token=${encodeURIComponent(
        confirmEmailToken
      )}`
    )
  );

export const ENTER_PASSWORD = new NuggetBuilder("enter_password")
  .whenAtPath("/sign_up/enter_password")
  .whenStateIncludes("password")
  .then(async ({ page, state: { password } }) => {
    await page.setValuesByName({
      "password_form[password]": password,
    });

    // Re-enter password field may not always be present
    try {
      await page.setValuesByName({
        "password_form[password_confirmation]": password,
      });
    } catch {}

    await page.submit();
  });
