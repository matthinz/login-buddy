# Login Buddy

Login Buddy is an assistant for working on Login.gov. It automates many common testing tasks, such as creating accounts and verifying your identity.

## Requirements

- Login.gov IdP codebase installed and running on <http://localhost:3000>
- Node.js (see [`.nvmrc`](./.nvmrc) for version)
- Yarn

## Getting started

First, create a `.env` file with your local configuration values. You can copy `.env.example` and fill in the relevant values.

Then, install dependencies and start:

```shell
$ yarn && yarn start
```

### Recommended IdP configuration

There are a few IdP settings that you should tweak if attempting to integrate Login Buddy with a locally running instance.

| Setting                             | Recommended value | Reason                                                                                                                                                |
| ----------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `development_mailer_deliver_method` | `file`            | This will write sent emails to .html files on the filesystem, which Login Buddy can parse and display the relevant information from in your terminal. |
| `enable_load_testing_mode`          | `true`            | This allows creating an account without verifying your email address (just a little faster for local dev).                                            |

## How to use

Login Buddy presents an interactive shell session you can use to enter commands to run.

### Command: `login`

Logs in using the credentials established in `signup`

| Options  | Description                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `--saml` | Signup using a SAML request from the [SAML Sinatra app][saml-sinatra]. Implies `--sp`                            |
| `--sp`   | Create the account after redirecting from a service provider. Requires [OIDC Sinatra app][oidc-sinatra] running. |

### Command: `logout`

Logs out your current session

| Option         | Description                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `--completely` | Delete _all_ login.gov cookies (including your "Remember this device" cookie). |

### Command: `signup`

Create a new account with a random email address.

| Option             | Description                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `--saml`           | Signup using a SAML request from the [SAML Sinatra app][saml-sinatra]. Implies `--sp`                            |
| `--sp`             | Create the account after redirecting from a service provider. Requires [OIDC Sinatra app][oidc-sinatra] running. |
| `--sms`            | Use SMS for 2 factor authentication                                                                              |
| `--until <string>` | Stop when the page title or URL contains `<string>`                                                              |
| `--verify`         | Also verify the identity for this account after signing up.                                                      |

### Command: `verify`

Take the account created via `signup` through the Identity Verification (IdV) flow.

| Option                                                | Description                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--bad-id`                                            | Use a bad identity document.                                                  |
| `--bad-phone`                                         | Use a phone number that will fail during phone verification                   |
| `--gpo`                                               | Verify using GPO (the "send me a letter" flow).                               |
| `--gpo-partial`                                       | Verify using GPO, but don't enter the OTP.                                    |
| `--mva-timeout`                                       | Simulate a timeout talking to AAMVA                                           |
| `--phone <string>`                                    | Specify the phone number to use during verification.                          |
| `--ssn <string>`                                      | Social Security Number to enter during verification.                          |
| `--threatMetrix <no_result / review / reject / pass>` | Simulate the given result from ThreatMetrix.                                  |
| `--throttle-gpo`                                      | Fail GPO OTP enough to get throttled.                                         |
| `--throttle-phone`                                    | Fails phone verification until the user is throttled (implies `--bad-phone`). |
| `--until <string>`                                    | Stop when the page title or URL contains `<string>`                           |

[oidc-sinatra]: https://github.com/18F/identity-oidc-sinatra
[saml-sinator]: https://github.com/18F/identity-saml-sinatra
