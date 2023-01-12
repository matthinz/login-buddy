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

### Command: `signup`

Create a new account with a random email address.

| Option             | Description                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `--sp`             | Create the account after redirecting from a service provider. Requires [OIDC Sinatra app][oidc-sinatra] running. |
| `--until <string>` | Stop when the page title or URL contains `<string>`                                                              |

### Command: `verify`

Take the account created via `signup` through the Identity Verification (IdV) flow.

| Option                     | Description                                         |
| -------------------------- | --------------------------------------------------- | ------ | ------ | -------------------------------------------- |
| `--gpo`                    | Verify using GPO (the "send me a letter" flow).     |
| `--threatMetrix <no_result | review                                              | reject | pass>` | Simulate the given result from ThreatMetrix. |
| `--until <string>`         | Stop when the page title or URL contains `<string>` |

[oidc-sinatra]: https://github.com/18F/identity-oidc-sinatra
