import { FlowBuilderInterface, fromState, selectorFound } from "../../../dsl";
import { VerifyOptions } from "../types";

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

    .submit()

    .type('[name="in_person_address[address1]"]', fromState("address1"))
    .type('[name="in_person_address[address2]"]', fromState("address2"))
    .type('[name="in_person_address[city]"]', fromState("state"))
    .select('[name="in_person_address[state]"]', fromState("state"))
    .type('[name="in_person_address[zipcode]"]', fromState("zip"))
    .click("label[for=in_person_address_same_address_as_id_true]")
    .submit();
}
