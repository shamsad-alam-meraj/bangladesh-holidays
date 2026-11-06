# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue. Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/shamsad-alam-meraj/bangladesh-holidays/security/advisories/new).

Include a description, the affected version, and steps to reproduce. You can expect an acknowledgement
within 7 days. Fixes are released as patch versions and disclosed in a security advisory once a fix
is available.

## Scope

This library has no runtime dependencies and performs no network or file-system access. Relevant
issues include, for example, CSV/ICS output that enables injection into consuming applications,
unbounded resource use from crafted input, and supply-chain concerns with the published package.

Incorrect holiday data is not a security issue. Please report it with the
**Holiday data correction** issue template.
