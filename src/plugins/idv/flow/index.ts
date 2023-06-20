import { VerifyOptions } from "../types";
import {
  atPath,
  FlowBuilderInterface,
  createFlow,
  optionSet,
  optionNotSet,
} from "../../../dsl";
import { doDocumentCapture } from "./document-capture";
import { doInPersonProofing } from "./ipp";
import { enterSsn } from "./ssn";
import { enterPhone } from "./phone";
import { enterGpoOtp, tryToCaptureGpoOtp } from "./gpo";

type InputState = {
  email: string;
  password: string;
  phone: string;
};

export const MOBILE_DOCUMENT_CAPTURE_FLOW = createFlow<{}, VerifyOptions>()
  .when(optionSet("uploadUrl"), (flow, { options: { uploadUrl } }) => {
    if (uploadUrl) {
      return flow.navigateTo(uploadUrl);
    }
    return flow;
  })
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

  .when(optionSet("inPerson"), doInPersonProofing)

  // "Enter your Social Security number"
  .then(enterSsn)

  // "Verify your information"
  .then(verifyYourInformation)

  .when(optionNotSet("throttleSsn"), (flow) =>
    flow
      .branch(
        optionSet("shouldRequestLetter"),
        // Branch: Use GPO
        (flow) =>
          // "Want a letter?"
          flow
            .navigateTo("/verify/usps")
            .submit('form[action="/verify/usps"] button[type=submit]'),
        // Branch: Don't use GPO
        enterPhone
      )

      // Bail if we have been phone throttled
      .when(optionNotSet("throttlePhone"), (flow) =>
        flow
          // "Re-enter your Login.gov password to protect your data"
          .expect("/verify/review")
          .type(
            '[name="user[password]"]',
            ({ state: { password } }) => password
          )
          .submit('form[action="/verify/review"] button[type=submit]')

          // Handle OTP before and after personal key
          .when(optionSet("shouldEnterGpoOtp"), (flow) =>
            flow.when(atPath("/verify/come_back_later"), (flow) =>
              flow.then(tryToCaptureGpoOtp).then(enterGpoOtp)
            )
          )

          // "Save your personal key"
          .expect("/verify/personal_key")

          .evaluate(async ({ frame, state }) => {
            const personalKey = (await frame.evaluate(() => {
              // @ts-ignore
              return document.querySelector<HTMLElement>(".personal-key-block")
                .innerText;
            })) as string;
            return { ...state, personalKey };
          })

          .click("label[for=acknowledgment]")
          .submit()

          .when(optionSet("shouldEnterGpoOtp"), (flow) =>
            flow.when(atPath("/verify/come_back_later"), (flow) =>
              flow.then(tryToCaptureGpoOtp).then(enterGpoOtp)
            )
          )
      )
  );

function verifyYourInformation<InputState extends {}, State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return flow
    .expect(({ options }) =>
      options.inPerson ? "/verify/in_person/verify" : "/verify/verify_info"
    )
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
      .expect(["/verify/doc_auth/upload", "/verify/hybrid_handoff"])
      .branch(
        ({ options }) => options.hybrid,

        // Hybrid flow
        (flow) =>
          flow
            .type('[name="doc_auth[phone]"]', ({ state: { phone } }) => phone)
            .submit('form[action*="type=mobile"] button[type=submit]')
            .evaluate(async (context) => {
              const {
                options: {
                  getLinkToHybridFlow,
                  getMobileBrowserFrame: getMobileBrowserPage,
                },
              } = context;

              const link = getLinkToHybridFlow && (await getLinkToHybridFlow());

              if (!link) {
                throw new Error("Could not determine link to hybrid flow");
              }

              if (!getMobileBrowserPage) {
                throw new Error("getMobileBrowserPage not provided");
              }

              const frame = await getMobileBrowserPage();

              await MOBILE_DOCUMENT_CAPTURE_FLOW.run({
                ...context,
                hooks: undefined,
                options: {
                  ...context.options,
                  uploadUrl: new URL(link),
                },
                frame,
              });

              await frame.page().close();

              return context.state;
            })
            .waitUntil(atPath("/verify/ssn")),

        // Standard flow
        (flow) =>
          flow
            .submit('form[action*="?type=desktop"] button[type=submit]')
            .expect("/verify/document_capture")
            .then(doDocumentCapture)
      )
  );
}
