# Contributing to the Exulu frontend

Thanks for wanting to contribute. This page explains the terms your contribution
is accepted under, and the practical steps.

## Before your pull request can be merged

**1. Agree to the Contributor License Agreement.**

Every contributor must agree to the [Contributor License Agreement](CLA.md)
before we can merge their work. You keep ownership of your contribution; the
agreement gives Qventu B.V. the rights it needs to distribute and license it.

When you open a pull request, a bot will check whether you have already agreed.
If you have not, it will comment with a one-line instruction. Agreement is
recorded against your GitHub account and you only need to do it once.

**2. Sign off your commits.**

Add a `Signed-off-by` line to each commit, certifying the
[Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "your message"
```

Use your real name and an address you can be reached at.

**3. Declare anything you did not write.**

If your contribution includes or is derived from code, fonts, icons, images or
other material you did not write yourself, say so in the pull request
description and name the licence. This code ships as part of a commercially
licensed product, so copyleft, non-commercial or unclear licences cannot be
accepted. If you are unsure, ask in the pull request rather than leaving it out.

## Why there is a CLA on an MIT-licensed repository

This repository is MIT licensed (see [`LICENSE`](LICENSE)), but it is one half of
a product whose backend is licensed commercially. We may distribute this code
under other terms as part of that product, and MIT alone does not give us a
patent grant or a clear relicensing right.

The CLA covers both. The DCO sign-off gives the per-commit record alongside it.

## Practical steps

1. Open an issue first for anything substantial, so we can agree on the approach before you spend time on it.
2. Fork the repository and branch from `main`.
3. Write tests. The project uses Vitest.
4. Run what CI runs, before you push:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   node scripts/check-messages.js   # en/de message parity
   npm run build
   ```
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit subjects.
6. Open the pull request against `main`.

## What we are likely to ask for

- A clear description of the problem, not only the change.
- Tests that would have failed before your change.
- Both `en` and `de` messages updated when you add user-facing strings. CI fails on parity.
- No new runtime dependency without a reason in the pull request description, including its licence.

## Security

Please do not open public issues for security problems, and never commit
credentials. A secret scan runs on every push. Report security issues privately
to [info@qventu.com](mailto:info@qventu.com).

## Questions

[info@qventu.com](mailto:info@qventu.com)
