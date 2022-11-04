import path from "path";
import { Flow } from "./types";

export const VERIFY_FLOW: Flow = [
  {
    name: "Welcome",
    url: "http://localhost:3000/verify",
    submitSelector:
      "form[action='/verify/doc_auth/welcome'] button[type=submit]",
  },
  {
    name: "How verifying works",
    submitSelector:
      "form[action='/verify/doc_auth/agreement'] button[type=submit]",
    async run(tab, state) {
      await tab.click("label[for=doc_auth_ial2_consent_given]");
    },
  },
  {
    name: "How would you like to upload",
    submitSelector:
      "form[action='/verify/doc_auth/upload?type=desktop'] button[type=submit]",
  },
  {
    name: "Add your state-issued ID",
    submitSelector: "button[type=submit]",
    async run(tab, state) {
      let promise = Promise.resolve();

      [1, 2].forEach((index) => {
        promise = promise.then(async () => {
          const [fileChooser] = await Promise.all([
            tab.waitForFileChooser(),
            tab.click(`#file-input-${index}`),
          ]);

          await fileChooser.accept([
            path.join(__dirname, "../../proofing.yml"),
          ]);
        });
      });

      await promise;
    },
  },
  {
    name: "Enter your social security number",
    url: "http://localhost:3000/verify/doc_auth/ssn",
    submitSelector: "button[type=submit]",
    async run(tab, state) {
      state.ssn = "666-12-3456";
      await tab.type("input[name='doc_auth[ssn]']", state.ssn);
    },
  },
  {
    name: "Verify your information",
    submitSelector:
      "form[action='/verify/doc_auth/verify'] button[type=submit]",
  },
];
