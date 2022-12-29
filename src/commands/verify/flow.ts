import { createFlow, navigateTo } from "../../dsl";
import { VerifyOptions } from "./types";
import { SignUpState } from "../sign-up";
import { FlowInterface } from "../../dsl/types";

const PROOFING_YAML = `
document:
  type: license
  first_name: Susan
  last_name: Smith
  middle_name: Q
  address1: 1 Microsoft Way
  address2: Apt 3
  city: Bayside
  state: NY
  zipcode: '11364'
  dob: 10/06/1938
  phone: +1 314-555-1212
  state_id_number: '123456789'
  state_id_type: drivers_license
  state_id_jurisdiction: 'NY'
`.trim();

export const VERIFY_FLOW = createFlow<SignUpState, VerifyOptions>()
  .navigateTo("/verify")
  .expectUrl("/verify/doc_auth/welcome")
  .submit()

  // "How verifying your identity works"
  .expectUrl("/verify/doc_auth/agreement")
  .click("label[for=doc_auth_ial2_consent_given]")
  .submit()

  // "How would you like to upload your state-issued ID?"
  .expectUrl("/verify/doc_auth/upload")
  .submit(
    'form[action="/verify/doc_auth/upload?type=desktop"] button[type=submit]'
  )

  // "Add your state-issued ID"
  .expectUrl("/verify/doc_auth/document_capture")
  .upload("#file-input-1", "proofing.yml", PROOFING_YAML)
  .upload("#file-input-2", "proofing.yml", PROOFING_YAML)
  .submit()

  // NOTE: Pause for processing documents

  // "Enter your Social Security number"
  .expectUrl("/verify/doc_auth/ssn")
  .type('[name="doc_auth[ssn]"]', "666123456")
  .evaluate(async (page, state, options) => {
    await page.select("[name=mock_profiling_result]", options.threatMetrix);
  })
  .click(".password-toggle__toggle-label")
  .submit()

  // "Verify your information"
  .expectUrl("/verify/doc_auth/verify")
  .submit('form[action="/verify/doc_auth/verify"] button[type=submit]')

  .branch(
    (_page, _state, options) => options.gpo,
    // Branch: Use GPO
    (useGpo) =>
      // "Want a letter?"
      useGpo
        .navigateTo("/verify/usps")
        .submit('form[action="/verify/usps"] button[type=submit]'),
    // Branch: Don't use GPO
    (noGpo) =>
      noGpo
        // "Enter your phone number"
        .expectUrl("/verify/phone")
        .generate("phone", () => "3602345678")
        .type('[name="idv_phone_form[phone]"]', (state) => state.phone)
        .submit()

        // "Enter your one-time code"
        .expectUrl("/verify/phone_confirmation")
        .submit('form[action="/verify/phone_confirmation"] button[type=submit]')
  )

  // "Re-enter your Login.gov password to protect your data"
  .expectUrl("/verify/review")
  .type('[name="user[password]"]', (state) => state.password)
  .submit('form[action="/verify/review"] button[type=submit]')

  // "Save your personal key"
  .expectUrl("/verify/personal_key")
  .evaluateAndModifyState(async (page, state) => {
    const personalKey = (await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector(".personal-key-block").innerText;
    })) as string;
    return { ...state, personalKey };
  })
  .click("label[for=acknowledgment]")
  .submit();
