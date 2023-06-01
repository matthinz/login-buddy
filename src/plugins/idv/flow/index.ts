import { VerifyOptions } from "../types";
import {
  atPath,
  FlowBuilderInterface,
  createFlow,
  notAtPath,
  selectorFound,
} from "../../../dsl";
import { doDocumentCapture } from "./document-capture";

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

  .when(({ options }) => options.inPerson, doInPerson)

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

              .when(atPath("/verify/come_back_later"), enterGpoOtp)
        )
  );

function doInPerson<State extends InputState>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State, VerifyOptions> {
  return flow
    .generate("firstName", () => "Testy")
    .generate("lastName", () => "McTesterson")
    .generate("birthDate", () => new Date(1989, 3, 15))
    .generate("stateIdNumber", () => "FOOBAR")
    .generate("issuingState", () => "WA")

    .generate("address1", () => "1234 Fake St")
    .generate("address2", () => "Apt 99")
    .generate("city", () => "Imaginarytown")
    .generate("state", () => "OH")
    .generate("zip", () => "45454")

    .waitUntil(selectorFound("form .usa-button--outline"))

    .click("form .usa-button--outline")
    .submit(".usa-button")

    .type(".usa-input", "Baltimore")
    .click("button[type=submit].usa-button")

    .waitUntil(selectorFound(".location-collection-item .usa-button"))
    .click(".location-collection-item .usa-button")

    .waitUntil(selectorFound('[name="state_id[first_name]"]'))
    .type(
      '[name="state_id[first_name]"]',
      ({ state: { firstName } }) => firstName
    )
    .type('[name="state_id[last_name]"]', ({ state: { lastName } }) => lastName)
    .type(
      '[name="state_id[dob][month]"]',
      ({ state: { birthDate } }) => birthDate.getMonth() + 1
    )
    .type('[name="state_id[dob][day]"]', ({ state: { birthDate } }) =>
      birthDate.getDate()
    )
    .type('[name="state_id[dob][year]"]', ({ state: { birthDate } }) =>
      birthDate.getFullYear()
    )
    .type(
      '[name="state_id[state_id_number]"]',
      ({ state: { stateIdNumber } }) => stateIdNumber
    )
    .select(
      '[name="state_id[state_id_jurisdiction]"]',
      ({ state: { issuingState } }) => issuingState
    )

    .submit()

    .type(
      '[name="in_person_address[address1]"]',
      ({ state: { address1 } }) => address1
    )
    .type(
      '[name="in_person_address[address2]"]',
      ({ state: { address2 } }) => address2
    )
    .type('[name="in_person_address[city]"]', ({ state: { city } }) => city)
    .select(
      '[name="in_person_address[state]"]',
      ({ state: { state } }) => state
    )
    .type('[name="in_person_address[zipcode]"]', ({ state: { zip } }) => zip)
    .click("label[for=in_person_address_same_address_as_id_true]")
    .submit();
}

function enterGpoOtp<State extends InputState>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State & { gpoOtp: string }, VerifyOptions> {
  return (
    flow
      .expect("/verify/come_back_later")
      .navigateTo("/account/verify")
      // "Welcome back"
      .evaluate(async ({ frame, state }) => {
        // Locally, IDP will put the OTP on the page for us to read.
        let gpoOtp = await frame.evaluate(() => {
          const otpInput = document.querySelector(
            '[name="gpo_verify_form[otp]"]'
          ) as HTMLInputElement | undefined;

          if (!otpInput) {
            return;
          }

          const result = otpInput.value;
          otpInput.value = "";

          return result;
        });

        return { ...state, gpoOtp };
      })
      .generate("gpoOtp", async (): Promise<string> => {
        throw new Error("TODO: Prompt for GPO OTP");
      })
      .type('[name="gpo_verify_form[otp]"]', ({ state: { gpoOtp } }) => gpoOtp)
      .submit()
  );
}

function enterPhone<
  InputState extends {},
  State extends InputState & { phone: string }
>(
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
          flow.when(notAtPath("/verify/phone/errors/failure"), (flow) =>
            flow.click(".usa-button.usa-button--big").then(enterPhone)
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

function enterSsn<InputState extends {}, State extends InputState>(
  flow: FlowBuilderInterface<InputState, State, VerifyOptions>
): FlowBuilderInterface<InputState, State & { ssn: string }, VerifyOptions> {
  return flow
    .expect(({ options }) =>
      options.inPerson ? "/verify/in_person/ssn" : "/verify/ssn"
    )
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
    .evaluate(async ({ frame, options, state }) => {
      const $mockProfilingResult = await frame.$(
        "[name=mock_profiling_result]"
      );
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

function generateSsn(prefix = "666"): string {
  let result = prefix;
  while (result.length < 9) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
}
