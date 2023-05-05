import { VerifyOptions } from "./types";
import { atPath, Context, FlowBuilderInterface, createFlow } from "../../dsl";
import { generateBadIdYaml, generateGoodIdYaml } from "./id";

type InputState = {
  email: string;
  password: string;
  phone: string;
};

export const MOBILE_DOCUMENT_CAPTURE_FLOW = createFlow<{}, VerifyOptions>()
  .when(
    ({ options }) => !!options.uploadUrl,
    (flow, { options: { uploadUrl } }) => {
      if (uploadUrl) {
        return flow.navigateTo(uploadUrl);
      }
      return flow;
    }
  )
  .then(doDocumentCapture)
  .expect("/verify/hybrid_mobile/capture_complete");

export const VERIFY_FLOW = createFlow<InputState, VerifyOptions>()
  .navigateTo("/verify")
  .expect("/verify/doc_auth/welcome")
  .submit()

  // "How verifying your identity works"
  .expect("/verify/doc_auth/agreement")
  .click("label[for=doc_auth_ial2_consent_given]")
  .submit()

  .then(uploadId)

  // NOTE: Pause for processing documents

  // "Enter your Social Security number"
  .then(enterSsn)

  // "Verify your information"
  .then(verifyYourInformation)

  .when(
    ({ options }) => !options.throttleSsn,
    (flow) =>
      flow
        .branch(
          ({ options }) => options.gpo,
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
        .when(
          ({ options }) => !options.throttlePhone,
          (flow) =>
            flow

              // "Re-enter your Login.gov password to protect your data"
              .expect("/verify/review")
              .type(
                '[name="user[password]"]',
                ({ state: { password } }) => password
              )
              .submit('form[action="/verify/review"] button[type=submit]')

              // Handle OTP before and after personal key
              .when(atPath("/verify/come_back_later"), enterGpoOtp)

              // "Save your personal key"
              .expect("/verify/personal_key")

              .evaluate(async ({ page, state }) => {
                const personalKey = (await page.evaluate(() => {
                  // @ts-ignore
                  return document.querySelector<HTMLElement>(
                    ".personal-key-block"
                  ).innerText;
                })) as string;
                return { ...state, personalKey };
              })

              .click("label[for=acknowledgment]")
              .submit()

              .when(atPath("/verify/come_back_later"), enterGpoOtp)
        )
  );

function enterGpoOtp<State extends InputState>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State & { gpoOtp: string }, VerifyOptions> {
  return (
    flow
      .expect("/verify/come_back_later")
      .navigateTo("/account/verify")
      // "Welcome back"
      .evaluate(async ({ page, state }) => {
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

      .generate("gpoOtp", async () => {
        throw new Error("TODO: Prompt for GPO OTP");
      })
      .type('[name="gpo_verify_form[otp]"]', ({ state: { gpoOtp } }) => gpoOtp)
      .submit()
  );
}

function enterPhone<InputState, State extends InputState & { phone: string }>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return (
    flow
      // "Enter your phone number"
      .expect("/verify/phone")
      .type('[name="idv_phone_form[phone]"]', ({ state: { phone } }) => phone)
      .submit()

      .branch(
        ({ options }) => options.throttlePhone,
        (flow) =>
          flow.when(
            ({ page }) =>
              new URL(page.url()).pathname !== "/verify/phone/errors/failure",
            (flow) => flow.click(".usa-button.usa-button--big").then(enterPhone)
          ),
        (flow) =>
          flow
            // "Enter your one-time code"
            .expect("/verify/phone_confirmation")
            .submit(
              'form[action="/verify/phone_confirmation"] button[type=submit]'
            )
      )
  );
}

function enterSsn<InputState, State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return flow
    .expect("/verify/ssn")
    .generate("ssn", ({ options }) => {
      if (options.throttleSsn) {
        return generateSsn("123");
      } else if (options.ssn) {
        return options.ssn;
      } else {
        return generateSsn();
      }
    })
    .type('[name="doc_auth[ssn]"]', ({ state: { ssn } }) => ssn)
    .evaluate(async ({ page, options, state }) => {
      const $mockProfilingResult = await page.$("[name=mock_profiling_result]");
      if (!$mockProfilingResult) {
        if (options.threatMetrix !== "no_result") {
          throw new Error("ThreatMetrix mock not found on the page");
        }
        return state;
      }

      await $mockProfilingResult.select(options.threatMetrix);

      return state;
    })

    .click(".password-toggle__toggle-label")
    .submit();
}

function verifyYourInformation<InputState, State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return flow
    .expect("/verify/verify_info")
    .click(".usa-checkbox__label")
    .submit("button[type=submit].usa-button--big")

    .when(
      ({ options }) => options.throttleSsn,
      (flow) =>
        flow.when(atPath("/verify/session/errors/warning"), (flow) =>
          flow.click(".usa-button").then(verifyYourInformation)
        )
    );
}

function uploadId<State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return (
    flow
      // "How would you like to upload your state-issued ID?"
      .expect("/verify/doc_auth/upload")
      .branch(
        ({ options }) => options.hybrid,

        // Hybrid flow
        (flow) =>
          flow
            .type('[name="doc_auth[phone]"]', ({ state: { phone } }) => phone)
            .submit(
              'form[action="/verify/doc_auth/upload?combined=true&type=mobile"] button[type=submit]'
            )
            .evaluate(async (context) => {
              const {
                options: { getLinkToHybridFlow, getMobileBrowserPage },
              } = context;

              const link = getLinkToHybridFlow && (await getLinkToHybridFlow());

              if (!link) {
                throw new Error("Could not determine link to hybrid flow");
              }

              if (!getMobileBrowserPage) {
                throw new Error("getMobileBrowserPage not provided");
              }

              const page = await getMobileBrowserPage();

              await MOBILE_DOCUMENT_CAPTURE_FLOW.run({
                ...context,
                options: {
                  ...context.options,
                  uploadUrl: new URL(link),
                },
                page,
              });

              await page.close();

              return context.state;
            })
            .waitUntil(atPath("/verify/ssn")),

        // Standard flow
        (flow) =>
          flow
            .submit(
              'form[action="/verify/doc_auth/upload?type=desktop"] button[type=submit]'
            )
            .expect("/verify/document_capture")
            .then(doDocumentCapture)
      )
  );
}

function generateSsn(prefix = "666"): string {
  let result = prefix;
  while (result.length < 9) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
}

function generateIdYaml<State>({ options }: Context<State, VerifyOptions>) {
  return options.badId ? generateBadIdYaml() : generateGoodIdYaml();
}

function doDocumentCapture<State>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State, VerifyOptions> {
  return flow
    .upload("#file-input-1", "proofing.yml", generateIdYaml)
    .upload("#file-input-2", "proofing.yml", generateIdYaml)
    .submit();
}
