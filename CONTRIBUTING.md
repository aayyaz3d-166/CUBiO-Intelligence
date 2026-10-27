# Contributing to ONE Language

Thank you for your interest in contributing to ONE Language! We welcome contributions from developers worldwide to advance spatial, deterministic, and high-performance computing.

---

## 1. Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please treat everyone with respect, professionalism, and constructive collaboration.

---

## 2. Developer Certificate of Origin (DCO 1.1)

To ensure clear legal provenance and protect both contributors and users, ONE Language uses the **Developer Certificate of Origin (DCO), Version 1.1**.

### Signing Off Commits

Every commit submitted to this project must include a `Signed-off-by:` line in its commit message, certifying that you have the right to submit the work:

```bash
git commit -s -m "feat(compiler): add new syntax parsing rule"
```

This will automatically append your name and email address:
```text
Signed-off-by: Full Name <author@example.com>
```

### Full DCO 1.1 Text

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it; and

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

---

## 3. Contributor Copyright & Licensing Terms

1. **Copyright Retention:**  
   Signing the DCO does **not** transfer or assign your copyright ownership to the project owner or any other entity. You retain copyright ownership of your original contributions.

2. **Outbound Contribution Licensing:**  
   By signing off on your commit, you grant ONE Language and all downstream recipients a perpetual, worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your contribution under the project's dual license:
   - **MIT License** ([LICENSE-MIT](LICENSE-MIT))
   - **Apache License, Version 2.0** ([LICENSE-APACHE](LICENSE-APACHE))

3. **No Unilateral Relicensing:**  
   Because contributors retain their copyright, the project cannot unilaterally relicense community contributions to a closed, proprietary, or incompatible license in future versions without contributor consent.

---

## 4. Third-Party Code & Imported Dependencies

If your contribution includes code authored by a third party:
- The third-party code must be under a permissive open-source license compatible with `MIT OR Apache-2.0` (such as MIT, Apache-2.0, BSD-2/3-Clause, or ISC).
- Copyleft code (such as GPL, AGPL, or LGPL) is **strictly prohibited** to preserve the permissive nature of ONE Language.
- Existing copyright notices, license headers, and attribution files must be preserved and documented in the commit and in `NOTICE`.

---

## 5. Architectural Invariants

Contributions to the core compiler and runtime must respect the project's foundational architectural boundaries:
- **Address369 Confinement:** Coordinate manifolds must remain strictly bounded to `[0..368]`.
- **VIG Separation:** Visual Instruction Grammar abstractions must remain partitioned from native compiler logic.
- **Fail-Closed Actuation Lock:** The hardware actuation lock (`actuationLock: true`) must remain hardwired and fail-closed under all circumstances.

---

## 6. Reporting Rights Conflicts & Intellectual Property Inquiries

If you believe any code, documentation, or asset in this repository infringes upon your copyright, patent, trademark, or other intellectual property rights, please notify the project maintainers immediately with:
1. Identification of the copyrighted work or asset claimed to be infringed;
2. Identification of the material within this repository that is claimed to be infringing, including file paths and line numbers;
3. Your contact information and evidence of legal authority.

All reports will be promptly reviewed and investigated in good faith.
