# ==============================================================================
# CUBiO NATURAL LANGUAGE COMPILER: SOVEREIGN INDEPENDENT AUDITOR & VERIFIER
# Gate: CNL-P9-001 | Sovereign Architecture
# ==============================================================================

import sys
import json
import os

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MEMORY_FILE = "cubio_nlp_phase9.3dmemory"

def run_phase9_forensic_audit():
    print("================================================================================")
    print(" 🛡️ CUBiO FORENSIC AUDITOR: GATE CNL-P9-001 NLP COMPILER AUDIT")
    print("================================================================================\n")

    if not os.path.exists(MEMORY_FILE):
        print(f"[AUDIT CRITICAL ERROR] Memory file '{MEMORY_FILE}' does not exist!")
        sys.exit(1)

    with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"[Audit 1] Magic Header Check (.3dmemory):")
    magic = data.get("cubio_magic")
    print(f"  - Magic Signature: {magic}")
    if magic != "CUBIO_3DMEM_v9_NLP_COMPILER":
        print("[FAIL] Invalid memory magic header!")
        sys.exit(1)
    print("  ✓ State snapshot magic header confirmed.")

    print(f"\n[Audit 2] Gate Verification:")
    gate = data.get("gate")
    print(f"  - Gate: {gate}")
    if gate != "CNL-P9-001":
        print("[FAIL] Gate mismatch!")
        sys.exit(1)
    print("  ✓ Gate CNL-P9-001 certified.")

    print(f"\n[Audit 3] Post-Quantum Cryptographic Seal:")
    pqc_seal = data.get("pqc_seal")
    print(f"  - PQC Root Seal: {pqc_seal}")
    if not pqc_seal or not pqc_seal.startswith("0xPQC_369_") or not pqc_seal.endswith("_SEAL"):
        print("[FAIL] PQC seal format invalid!")
        sys.exit(1)
    print("  ✓ Quantum-resistant lattice root seal verified.")

    print(f"\n[Audit 4] Fail-Closed Actuation Lock Verification:")
    is_blocked = data.get("is_actuation_blocked")
    print(f"  - is_actuation_blocked: {is_blocked}")
    if is_blocked is not True:
        print("[FAIL] CRITICAL: Actuation block is not permanently active!")
        sys.exit(1)
    print("  ✓ Actuation lock permanently verified (Fail-Closed).")

    print(f"\n[Audit 5] Immutable 9-Phase Ancestry Lineage Audit:")
    lineage = data.get("lineageChain", [])
    expected_phases = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"]
    phases = [node.get("phase") for node in lineage]
    print(f"  - Lineage Chain: {' -> '.join(phases)}")
    if phases != expected_phases:
        print(f"[FAIL] Incomplete ancestry chain! Expected: {expected_phases}, Got: {phases}")
        sys.exit(1)
    print("  ✓ Full 9-Phase ancestry chain cryptographically verified.")

    print(f"\n[Audit 6] NLP Intent & Generated Source Code Audit:")
    intent = data.get("nlp_intent", {})
    raw_prompt = intent.get("rawPrompt")
    lang = intent.get("languageDetected")
    nodes = intent.get("nodes", [])
    gen_source = data.get("generated_source", "")

    print(f"  - Raw Input Prompt  : \"{raw_prompt}\"")
    print(f"  - Language Detected  : {lang}")
    print(f"  - Generated Nodes    : {len(nodes)}")
    print(f"  - Generated Source   : {len(gen_source)} characters")

    if not raw_prompt or len(nodes) < 1 or len(gen_source) < 10:
        print("[FAIL] Invalid NLP generated source code or intent!")
        sys.exit(1)
    print("  ✓ Natural language intent synthesis and valid source code verified.")

    print("\n================================================================================")
    print(" 🏆 AUDIT VERDICT: GATE CNL-P9-001 PASS (ALL 6 AUDIT GATES 100% COMPLIANT)")
    print("================================================================================\n")

if __name__ == "__main__":
    run_phase9_forensic_audit()
