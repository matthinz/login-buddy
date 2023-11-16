import { FlowBuilderInterface } from "../../../dsl";
import { VerifyOptions } from "../types";

export function enterSsn<InputState extends {}, State extends InputState>(
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
        if (
          options.threatMetrix !== "no_result" &&
          options.threatMetrix != null
        ) {
          throw new Error("ThreatMetrix mock not found on the page");
        }
        return state;
      }

      if (options.threatMetrix == null) {
        return state;
      }

      await $mockProfilingResult.select(options.threatMetrix);

      return state;
    })

    .click(".password-toggle__toggle-label")
    .submit();
}

function generateSsn(prefix = "666"): string {
  let result = prefix;
  while (result.length < 9) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
}
