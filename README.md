# Login Buddy

Login Buddy is an assistant for working on Login.gov. It automates many common testing tasks, such as creating accounts and verifying your identity.

## Requirements

- Login.gov codebase installed and running on <http://localhost:3000>
- Node.js (see [`.nvmrc`](./.nvmrc) for version)
- Yarn

## Getting started:

```shell
$ yarn && yarn start
```

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

### Command: `verify`

Take the account created via `signup` through the Identity Verification (IdV) flow.

| Option                                                | Description                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--bad-id`                                            | Use a bad identity document.                                                  |
| `--bad-phone`                                         | Use a phone number that will fail during phone verification                   |
| `--gpo`                                               | Verify using GPO (the "send me a letter" flow).                               |
| `--phone <string>`                                    | Specify the phone number to use during verification.                          |
| `--ssn <string>`                                      | Social Security Number to enter during verification.                          |
| `--threatMetrix <no_result / review / reject / pass>` | Simulate the given result from ThreatMetrix.                                  |
| `--throttle-phone`                                    | Fails phone verification until the user is throttled (implies `--bad-phone`). |
| `--until <string>`                                    | Stop when the page title or URL contains `<string>`                           |

[oidc-sinatra]: https://github.com/18F/identity-oidc-sinatra
[saml-sinator]: https://github.com/18F/identity-saml-sinatra
