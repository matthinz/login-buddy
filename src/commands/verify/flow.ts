import { navigateTo } from "../../dsl";

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

export const VERIFY_FLOW = navigateTo("/verify")
  .expectUrl("/verify/doc_auth/welcome")
  .submit()

  // "How verifying your identity works"
  .expectUrl("/verify/doc_auth/agreement")
  .click("label[for=doc_auth_ial2_consent_given]")
  .submit()

  // "How would you like to upload your state-issued ID?"
  .expectUrl("/verify/doc_auth/upload")
  .click(
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
  .click(".password-toggle__toggle-label");
