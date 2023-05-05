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
`;

export function generateGoodIdYaml(): string {
  return PROOFING_YAML.trim();
}

export function generateBadIdYaml(): string {
  return `
${PROOFING_YAML}
failed_alerts:
  - name: 1D Control Number Valid # See list of valid names below
    result: Failed # values: Passed, Failed, Attention, Caution
    `.trim();
}
