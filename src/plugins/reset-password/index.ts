import { GlobalState, PluginOptions } from "../../types";
import { Frame } from "puppeteer";
import { signOut } from "../sign-out";
import { BrowserHelper } from "../../browser";
import { EventBus } from "../../events";

type ResetPasswordOptions = {
  baseURL: URL;
};

/**
 * Plugin providing a "resetpassword" command.
 */
export function resetPasswordPlugin({
  browser,
  events,
  programOptions,
  state,
}: PluginOptions) {
  const getResetPasswordToken = createResetPasswordTokenGetter(events);

  events.on("command:resetpassword", async ({ args, frameId }) => {
    const frame =
      (await browser.getFrameById(frameId)) ??
      (await browser.tryToReusePage(programOptions.baseURL)).mainFrame();

    const nextState = await resetPassword(
      frame,
      browser,
      programOptions,
      state.current(),
      getResetPasswordToken
    );

    state.update({
      ...nextState,
      loggedIn: false,
    });
  });
}

async function resetPassword(
  frame: Frame,
  browser: BrowserHelper,
  options: ResetPasswordOptions,
  state: GlobalState,
  getResetPasswordToken: () => Promise<EmailAndToken>
): Promise<GlobalState> {
  const email = state.lastSignup?.email;
  7;
  const oldPassword = state.lastSignup?.password;

  if (email == null || oldPassword == null) {
    throw new Error("You need to sign up before you reset your password");
  }

  const signedOutState = await signOut(
    state,
    {
      baseURL: options.baseURL,
      cleanUp: false,
      completely: true,
    },
    frame,
    browser
  );

  await frame.goto(new URL("/users/password/new", options.baseURL).toString());

  await frame.type('[name="password_reset_email_form[email]"]', email);

  await Promise.all([
    frame.click(".usa-button--big"),
    frame.waitForNavigation(),
  ]);

  const { token } = await getResetPasswordToken();

  await frame.goto(
    new URL(
      "/users/password/edit?reset_password_token=" + encodeURIComponent(token),
      options.baseURL
    ).toString()
  );

  const newPassword = makeNewPassword(oldPassword);
  await frame.type('[name="reset_password_form[password]"]', newPassword);
  await frame.type(
    '[name="reset_password_form[password_confirmation]"]',
    newPassword
  );

  await Promise.all([
    frame.click(".usa-button--big"),
    frame.waitForNavigation(),
  ]);

  const { lastSignup } = signedOutState;
  if (!lastSignup) {
    throw new Error("No previous signup");
  }

  return {
    ...signedOutState,
    lastSignup: {
      ...lastSignup,
      password: newPassword,
    },
  };
}

function makeNewPassword(oldPassword: string): string {
  const m = /(.*)(\d+)$/.exec(oldPassword);

  if (m) {
    return [m[1], parseInt(m[2], 10) + 1].join("");
  }

  return `${oldPassword}2`;
}

type EmailAndToken = { email: string; token: string };

function createResetPasswordTokenGetter(
  events: EventBus
): () => Promise<EmailAndToken> {
  let resolve: ((value: EmailAndToken) => void) | undefined;
  let promise = new Promise<EmailAndToken>((_resolve) => {
    resolve = _resolve;
  });

  events.on("message", ({ message }) => {
    if (message.type !== "email") {
      return;
    }

    if (!message.subject.includes("Reset your password")) {
      return;
    }

    const email = message.to[0];
    if (!email) {
      throw new Error("Message missing to");
    }

    const m = /\breset_password_token=([a-zA-Z0-9_-]+)/.exec(message.body);
    if (!m) {
      throw new Error("No password reset token found in email");
    }

    const token = decodeURIComponent(m[1]);

    const oldResolve = resolve;
    promise = new Promise<EmailAndToken>((_resolve) => {
      resolve = _resolve;
    });

    if (oldResolve) {
      oldResolve({ email, token });
    }
  });

  return () => promise;
}
