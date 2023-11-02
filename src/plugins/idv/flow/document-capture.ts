import { stringify } from "yaml";

import { Context, FlowBuilderInterface } from "../../../dsl";
import { VerifyOptions } from "../types";

const ID_YAML = {
  document: {
    type: "license",
    first_name: "Susan",
    last_name: "Smith",
    middle_name: "Q",
    address1: "1 Microsoft Way",
    address2: "Apt 3",
    city: "Bayside",
    state: "NY",
    zipcode: "11364",
    dob: "10/06/1938",
    phone: "+1 314-555-1212",
    state_id_number: "123456789",
    state_id_type: "drivers_license",
    state_id_jurisdiction: "NY",
  },
};

export function doDocumentCapture<State extends {}>(
  flow: FlowBuilderInterface<State, State, VerifyOptions>
): FlowBuilderInterface<State, State, VerifyOptions> {
  return flow
    .upload("#file-input-1", "proofing.yml", generateIdYaml)
    .upload("#file-input-2", "proofing.yml", generateIdYaml)
    .submit();
}

function generateIdYaml<InputState extends {}, State extends InputState>({
  options,
}: Context<InputState, State, VerifyOptions>) {
  if (options.badId) {
    return generateBadIdYaml();
  }

  if (options.barcodeReadError) {
    return generateBarcodeReadErrorYaml();
  }

  return generateGoodIdYaml(
    options.mvaTimeout && {
      // Have to use an AAMVA-supported jurisdiction
      state: "WA",
      state_id_jurisdiction: "WA",
      state_id_number: "mvatimeout",
    },
    options.state
      ? {
          state: options.state,
          state_id_jurisdiction: options.state,
        }
      : undefined
  );
}

function generateGoodIdYaml(
  ...documentTweaks: (Record<string, unknown> | void | false)[]
): string {
  const data = JSON.parse(JSON.stringify(ID_YAML));

  return stringify({
    ...data,
    document: documentTweaks.reduce<Record<string, unknown>>(
      (result, tweak) => {
        if (tweak) {
          return {
            ...result,
            ...tweak,
          };
        }
        return result;
      },
      data.document
    ),
  });
}

function generateBadIdYaml(): string {
  return stringify({
    ...ID_YAML,
    failed_alerts: [
      {
        name: "1D Control Number Valid",
        result: "Failed",
      },
    ],
  });
}

function generateBarcodeReadErrorYaml(): string {
  return stringify({
    ...ID_YAML,
    failed_alerts: [
      {
        name: "2D Barcode Read",
        result: "Attention",
      },
    ],
  });
}
