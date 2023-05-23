import { stringify } from "yaml";

const DATA = {
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

export function generateGoodIdYaml(
  documentTweaks?:
    | (Record<string, unknown> | void | false)
    | (Record<string, unknown> | void | false)[]
): string {
  const data = JSON.parse(JSON.stringify(DATA));

  documentTweaks = Array.isArray(documentTweaks)
    ? documentTweaks
    : [documentTweaks];

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

export function generateBadIdYaml(): string {
  return stringify({
    ...DATA,
    failed_alerts: [
      {
        name: "1D Control Number Valid",
        result: "Failed",
      },
    ],
  });
}
