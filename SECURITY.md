# Security Policy

## Supported versions

`redmine_pull_requests` is maintained on a best-effort basis. Security fixes
are made for the latest release only. Please update to the latest release
before reporting a problem.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Please report suspected vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/aarondpn/redmine_pull_requests/security/advisories/new).
Do not open a public issue, discussion, or pull request for an undisclosed
vulnerability.

Include, when possible:

- the affected plugin and Redmine versions;
- a description of the impact and the conditions required to reproduce it;
- minimal reproduction steps or a proof of concept; and
- any suggested mitigation or fix.

Reports about webhook signature or token verification, authorization bypass
(e.g. seeing or changing pull requests of issues you can't access), leaked
access tokens, and cross-site scripting through pull request data are
especially useful. Vulnerabilities in Redmine itself, GitHub or GitLab should
be reported to those projects.

## What to expect

The maintainers aim to acknowledge a report within 7 days and to provide an
initial assessment within 14 days. If a report is accepted, a fix is prepared
privately and published in a new release together with a GitHub security
advisory, crediting the reporter unless they prefer to remain anonymous.

Please only test against Redmine, GitHub and GitLab instances you own or are
explicitly authorized to test.
