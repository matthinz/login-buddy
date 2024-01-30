import { FlowBuilderInterface, fromState, selectorFound } from "../../../dsl";
import { VerifyOptions } from "../types";

export function switchToInPersonProofing<State extends {}>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State, VerifyOptions> {
  return flow
    .waitUntil(selectorFound("form .usa-button--outline"))
    .click("form .usa-button--outline");
}

export function doInPersonProofing<State extends {}>(
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

    .submit(".usa-button")

    .type(
      "lg-validated-field:nth-of-type(1) .usa-input",
      ({ state }) => state.address1
    )
    .type(
      "lg-validated-field:nth-of-type(2) .usa-input",
      ({ state }) => state.city
    )
    .select(
      "lg-validated-field:nth-of-type(3) select",
      ({ state }) => state.state
    )
    .type(
      "lg-validated-field:nth-of-type(4) .usa-input",
      ({ state }) => state.zip
    )
    .click("button[type=submit].usa-button")

    .waitUntil(selectorFound(".location-collection-item .usa-button"))
    .click(".location-collection-item .usa-button")

    .waitUntil(selectorFound('[name="state_id[first_name]"]'))
    .type(
      '[name="state_id[first_name]"]',
      ({ state: { firstName } }) => firstName
    )
    .type('[name="state_id[last_name]"]', fromState("state"))
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
    .type('[name="state_id[state_id_number]"]', fromState("stateIdNumber"))
    .select(
      '[name="state_id[state_id_jurisdiction]"]',
      fromState("issuingState")
    )

    .type('[name="state_id[identity_doc_address1]"]', fromState("address1"))
    .type('[name="state_id[identity_doc_address2]"]', fromState("address2"))
    .type('[name="state_id[identity_doc_city]"]', fromState("state"))
    .select('[name="state_id[identity_doc_address_state]"]', fromState("state"))
    .type('[name="state_id[identity_doc_zipcode]"]', fromState("zip"))
    .click("label[for=state_id_same_address_as_id_true]")
    .submit();
}
