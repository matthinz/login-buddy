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

export { CANCEL_IDV_FLOW } from "./cancel";

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
  .expect([
    "/verify/welcome",
    "/verify/doc_auth/welcome",
    "/verify/getting_started",
  ])

  .branch(
    atPath("/verify/getting_started"),
    // Variant: consent checkbox on unified "getting started page"
    (flow) => flow.click("label[for=doc_auth_idv_consent_given]").submit(),
    // Variant: separate welcome + getting started
    (flow) =>
      flow
        .submit() // "How verifying your identity works"
        .expect(["/verify/doc_auth/agreement", "/verify/agreement"])
        .click("label[for=doc_auth_idv_consent_given]")
        .submit()
  )

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
            .navigateTo("/verify/by_mail/request_letter")
            .submit(
              'form[action="/verify/by_mail/request_letter"] button[type=submit]'
            ),
        // Branch: Don't use GPO
        enterPhone
      )

      // Bail if we have been phone throttled
      .when(optionNotSet("throttlePhone"), (flow) =>
        flow
          // "Re-enter your Login.gov password to protect your data"
          .expect("/verify/enter_password")
          .type(
            '[name="user[password]"]',
            ({ state: { password } }) => password
          )
          .submit('form[action="/verify/enter_password"] button[type=submit]')

          // Handle OTP before and after personal key
          .when(optionSet("shouldRequestLetter"), (flow) =>
            flow.when(atPath("/verify/by_mail/letter_enqueued"), (flow) =>
              flow.then(tryToCaptureGpoOtp)
            )
          )
          .when(optionSet("shouldEnterGpoOtp"), (flow) =>
            flow.navigateTo("/verify/by_mail/enter_code").then(enterGpoOtp)
          )

          .when(
            async ({ options }) =>
              !options.shouldRequestLetter || options.shouldEnterGpoOtp,
            // Branch: We're either done with GPO flow or we didn't enter it
            (flow) =>
              flow
                // "Save your personal key"
                .expect("/verify/personal_key")

                .evaluate(async ({ frame, state }) => {
                  const personalKey = (await frame.evaluate(() => {
                    // @ts-ignore
                    return document.querySelector<HTMLElement>(
                      ".personal-key-block"
                    ).innerText;
                  })) as string;
                  return { ...state, personalKey };
                })

                .click("label[for=acknowledgment]")
                .submit()
          )
      )
  );

function verifyYourInformation<InputState extends {}, State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State, VerifyOptions> {
  return flow
    .expect(({ options }) =>
      options.inPerson ? "/verify/in_person/verify_info" : "/verify/verify_info"
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
