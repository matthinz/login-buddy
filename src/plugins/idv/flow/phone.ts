import { FlowBuilderInterface, notAtPath, optionSet } from "../../../dsl";
import { VerifyOptions } from "../types";

export function enterPhone<
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
        optionSet("throttlePhone"),
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
