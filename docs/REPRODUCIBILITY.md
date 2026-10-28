# ONE LANGUAGE — REPRODUCIBLE BUILDS & VERIFICATION GUIDE
**Specification Status:** LOCKED / VERIFIED (Task 27)  
**Authority:** Release Engineering & Build Quality Assurance

---

## 1. Toolchain & Hardware Environment

To achieve bit-exact reproducibility ($\sigma^2 = 0.0$) and verify release artifacts, builds must execute under the certified environment:

| Tool / Environment Parameter | Certified Version | Mandatory Minimum |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Enterprise (Version 10.0.26300 x64) | Windows 10 x64 |
| **Node.js Runtime** | `v24.14.1` (x64) | Node.js `20.0.0` LTS |
| **npm Package Manager** | `10.8.2` | `9.0.0` |
| **TypeScript Compiler** | `5.4.5` (via `devDependencies`) | `5.0.0` |
| **ESBuild Bundler** | `0.20.2` | `0.19.0` |
| **VSCE Package Tool** | `@vscode/vsce 2.24.0` | `2.15.0` |
| **CPU Architecture** | Intel x86_64 / AMD64 | 64-bit multi-core |
| **Physical RAM** | $\ge 16$ GB RAM | 8 GB RAM |

---

## 2. Step-by-Step Artifact Generation

### 2.1 Building Standalone Native Binary (`one.exe`)
The standalone executable embeds the bundled CLI, runtime bytecode, and Node Single Executable Application (SEA) blob into a zero-dependency Windows PE32+ executable.

```powershell
# 1. Clean previous bundle artifacts
Remove-Item -Recurse -Force dist/cli-bundle.cjs, dist/sea-prep.blob -ErrorAction SilentlyContinue

# 2. Run the packaging pipeline
node scripts/build-standalone-exe.cjs

# 3. Verify output binary
Get-Item dist/one.exe | Select-Object Name, Length, LastWriteTime
```
- **Output Artifact:** `dist/one.exe` (~97 MB)
- **Header Format:** Windows PE32+ (Machine: `0x8664` x86_64)

### 2.2 Packaging Visual Studio Code Extension (`.vsix`)
The extension package compiles the Language Server bundle with `esbuild`, validates TextMate grammars and snippet catalogs, and packages the result via `@vscode/vsce`.

```powershell
# 1. Package the extension
node scripts/package-vscode-extension.cjs

# 2. Verify output container
Get-Item dist/one-language-*.vsix | Select-Object Name, Length
```
- **Output Artifact:** `dist/one-language-1.0.0.vsix` (~1.96 MB)
- **Header Format:** PKZip Archive (Magic: `0x50, 0x4B, 0x03, 0x04`)

---

## 3. Comprehensive Verification Test Suite

Execute the standardized test suite commands to verify all modules and safety invariants:

```powershell
# 1. Core Language Syntax, Structs, Closures & Recursion
npm run test:struct_enum
npm run test:closures
npm run test:recursion
npm run test:async
npm run test:modules
npm run test:v101

# 2. ONEX Container Linker & Executable Packing
npm run test:packing

# 3. Memory Paging, Time-Travel & State Recovery
npm run test:task17
npm run test:task18

# 4. Five-Tier Orchestrator, IPC & Address369 Safety
npm run test:task19
npm run test:task20
npm run test:task24

# 5. Cross-Repository Substrate Parity Certification
npm run test:task26

# 6. Standalone Binary & VS Code Packaging Suites
npm run test:standalone
npm run test:vscode
```

---

## 4. Cryptographic Checksum Reference

Verify the integrity of frozen release candidates located in `dist/v1.0.1-rc/` using PowerShell `Get-FileHash`:

```powershell
Get-FileHash dist/v1.0.1-rc/* | Format-Table -AutoSize
```

### Certified Baseline Hashes
```
Algorithm Hash                                                             Path
--------- ----                                                             ----
SHA256    479186CA87F55781825DF05F5603AC3747ADA4C2E9AA78DE9E3CD233A993020E dist\v1.0.1-rc\one.exe
SHA256    33C8F6C59FD04ACAFC514D0D7BE4CC80ED397352348A7425FAFA349AC00C5B0D dist\v1.0.1-rc\one-language-1.0.1.vsix
SHA256    925FB6CF562378AFB824FE6709740018C554238B069E5BEB5144260851846ED5 dist\v1.0.1-rc\one-language-1.0.1-src.zip
```
Any mismatch indicates local corruption or uncommitted binary divergence.
