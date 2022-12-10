import { navigateTo } from "./dsl";

export const SIGN_UP_FLOW = navigateTo("/sign_up/enter_email")
  .generate("email", () => {
    const now = new Date();
    return [
      "test-",
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      "-",
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      "@example.org",
    ].join("");
  })
  .type("[name=user\\[email\\]]", (state) => state.email);

// import { Flow } from "./types";

// const DEFAULT_PASSWORD = "reallygoodpassword";

// export const SIGN_UP_FLOW: Flow = [
//   {
//     name: "Enter email",
//     url: "http://localhost:3000/sign_up/enter_email",
//     submitSelector: "button[type=submit]",
//     async run(tab, state) {
//       const now = new Date();
//       const email = [
//         "test-",
//         now.getFullYear(),
//         now.getMonth() + 1,
//         now.getDate(),
//         "-",
//         now.getHours(),
//         now.getMinutes(),
//         now.getSeconds(),
//         "@example.org",
//       ].join("");
//       const password = DEFAULT_PASSWORD;

//       Object.assign(state, {
//         email,
//         password,
//       });

//       await tab.type("[name=user\\[email\\]]", state.email);

//       await tab.click("label[for=user_terms_accepted]");
//     },
//   },
//   {
//     name: "Verify Email",
//     url: "",
//     submitSelector: "#confirm-now",
//   },
//   {
//     name: "Enter Password",
//     url: "",
//     submitSelector: "button[type=submit]",
//     async run(tab, state) {
//       await tab.type(
//         "[name=password_form\\[password\\]]",
//         state.password ?? ""
//       );
//     },
//   },
//   {
//     name: "Select two-factor method",
//     url: "",
//     submitSelector: "button[type=submit]",
//     async run(tab, state) {
//       await tab.click(
//         "label[for=two_factor_options_form_selection_backup_code]"
//       );
//     },
//   },
//   {
//     name: "Confirm use of backup codes",
//     url: "",
//     submitSelector: "button[type=submit]",
//   },
//   {
//     name: "Backup codes",
//     url: "",
//     submitSelector: "button[type=submit]",
//     async run(tab, state) {
//       state.backupCodes = await tab.evaluate((): string[] => {
//         return [].map.call(
//           // @ts-ignore
//           document.querySelectorAll("main code"),
//           // @ts-ignore
//           (el): string => el.innerText
//         ) as string[];
//       });
//     },
//   },
//   {
//     name: "Add backup method",
//     url: "",
//     submitSelector:
//       "form[action='/auth_method_confirmation/skip'] button[type=submit]",
//   },
// ];
