import { Page } from "puppeteer";
import { VerifyOptions } from "./types";
import { createFlow, FlowInterface, FlowRunOptions } from "../../dsl";
import { generateBadIdYaml, generateIdYaml } from "./id";

type InputState = {
  badId: boolean;
  email: string;
  password: string;
  phone: string;
  throttlePhone: boolean;
};

export const VERIFY_FLOW = createFlow<InputState, VerifyOptions>()
  .navigateTo("/verify")
  .expectUrl("/verify/doc_auth/welcome")
  .submit()

  // "How verifying your identity works"
  .expectUrl("/verify/doc_auth/agreement")
  .click("label[for=doc_auth_ial2_consent_given]")
  .submit()

  // "How would you like to upload your state-issued ID?"
  .expectUrl("/verify/doc_auth/upload")
  .branch(
    (_page, _state, options) => options.hybrid,
    // Hybrid flow
    (flow) =>
      flow
        .submit("button.usa-button--big[type=submit]")

        .expectUrl("/verify/doc_auth/send_link")
        .evaluate(() => {
          throw new Error("Complete hybrid flow not implemented");
        }),

    // Desktop flow
    (flow) =>
      flow
        .submit(
          'form[action="/verify/doc_auth/upload?type=desktop"] button[type=submit]'
        )
        .then(uploadId)
  )

  // NOTE: Pause for processing documents

  // "Enter your Social Security number"
  .expectUrl("/verify/doc_auth/ssn")
  .generate<"ssn", string>(
    "ssn",
    (_state, options) => options.ssn ?? generateSsn()
  )
  .type('[name="doc_auth[ssn]"]', (state) => state.ssn)
  .evaluate(async (page, _state, options) => {
    const $mockProfilingResult = await page.$("[name=mock_profiling_result]");
    if (!$mockProfilingResult) {
      if (options.threatMetrix !== "no_result") {
        throw new Error("ThreatMetrix mock not found on the page");
      }
      return;
    }

    await $mockProfilingResult.select(options.threatMetrix);
  })
  .click(".password-toggle__toggle-label")
  .submit()

  // "Verify your information"
  .expectUrl("/verify/doc_auth/verify")
  .click(".usa-checkbox__label")
  .submit("button[type=submit].usa-button--big")

  .branch(
    (_page, _state, options) => options.gpo,
    // Branch: Use GPO
    (useGpo) =>
      // "Want a letter?"
      useGpo
        .navigateTo("/verify/usps")
        .submit('form[action="/verify/usps"] button[type=submit]'),
    // Branch: Don't use GPO
    enterPhone
  )

  // Bail if we have been phone throttled
  .branch(
    (_, state) => state.throttlePhone,
    doNothing,
    (flow) =>
      flow

        // "Re-enter your Login.gov password to protect your data"
        .expectUrl("/verify/review")
        .type('[name="user[password]"]', (state) => state.password)
        .submit('form[action="/verify/review"] button[type=submit]')

        // Handle OTP before and after personal key
        .branch(isComeBackLaterScreen, enterOtp, doNothing)

        // "Save your personal key"
        .expectUrl("/verify/personal_key")
        .evaluate(async (page, state) => {
          const personalKey = (await page.evaluate(() => {
            // @ts-ignore
            return document.querySelector(".personal-key-block").innerText;
          })) as string;
          return { ...state, personalKey };
        })
        .click("label[for=acknowledgment]")
        .submit()

        .branch(isComeBackLaterScreen, enterOtp, doNothing)
  );

function generateSsn(): string {
  let result = "666";
  while (result.length < 9) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
}

async function isComeBackLaterScreen(page: Page): Promise<boolean> {
  return new URL(page.url()).pathname === "/verify/come_back_later";
}

function doNothing<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
>(
  flow: FlowInterface<InputState, OutputState, Options>
): FlowInterface<InputState, OutputState, Options> {
  return flow;
}

function enterOtp<
  InputState,
  OutputState extends InputState,
  Options extends FlowRunOptions
>(
  flow: FlowInterface<InputState, OutputState, Options>
): FlowInterface<InputState, OutputState & { gpoOtp: string }, Options> {
  return (
    flow
      .expectUrl("/verify/come_back_later")
      .navigateTo("/account/verify")
      // "Welcome back"
      .evaluate(async (page, state) => {
        // Locally, IDP will put the OTP on the page for us to read.
        let gpoOtp = await page.evaluate(() =>
          // @ts-ignore
          {
            const otpInput = document.querySelector(
              '[name="gpo_verify_form[otp]"]'
            ) as HTMLInputElement | undefined;

            if (!otpInput) {
              return;
            }

            const result = otpInput.value;
            otpInput.value = "";

            return result;
          }
        );

        return { ...state, gpoOtp };
      })
      .askIfNeeded("gpoOtp", "Please enter your GPO one-time password")
      .type('[name="gpo_verify_form[otp]"]', (state) => state.gpoOtp)
      .submit()
  );
}

function enterPhone<
  InputState,
  OutputState extends InputState & { phone: string; throttlePhone: boolean },
  Options extends FlowRunOptions
>(
  flow: FlowInterface<InputState, OutputState, Options>
): FlowInterface<InputState, OutputState, Options> {
  return (
    flow
      // "Enter your phone number"
      .expectUrl("/verify/phone")
      .type('[name="idv_phone_form[phone]"]', (state) => state.phone)
      .submit()

      .branch(
        (_, state) => state.throttlePhone,
        (flow) =>
          flow.branch(
            (page) =>
              new URL(page.url()).pathname === "/verify/phone/errors/failure",
            doNothing,
            (flow) => flow.click(".usa-button.usa-button--big").then(enterPhone)
          ),
        (flow) =>
          flow
            // "Enter your one-time code"
            .expectUrl("/verify/phone_confirmation")
            .submit(
              'form[action="/verify/phone_confirmation"] button[type=submit]'
            )
      )
  );
}

function uploadId<
  InputState,
  OutputState extends InputState & { badId: boolean },
  Options extends FlowRunOptions
>(
  flow: FlowInterface<InputState, OutputState, Options>
): FlowInterface<InputState, OutputState, Options> {
  return flow
    .expectUrl("/verify/doc_auth/document_capture")
    .upload("#file-input-1", "proofing.yml", (state) =>
      state.badId ? generateBadIdYaml() : generateIdYaml()
    )
    .upload("#file-input-2", "proofing.yml", (state) =>
      state.badId ? generateBadIdYaml() : generateIdYaml()
    )
    .submit();
}
