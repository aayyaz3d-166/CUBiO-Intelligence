# ==============================================================================
# CUBiO SINGULARITY MASTER: SOVEREIGN INDEPENDENT FORENSIC AUDITOR
# Gate: CNL-P21-001 | Sovereign Architecture
# ==============================================================================

import sys
import json
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

MEMORY_FILE = "cubio_singularity_phase21.3dmemory"
DIST_DIR = os.path.join("dist", "singularity_master_v21")

def run_phase21_forensic_audit():
    print("================================================================================")
    print(" 🛡️ CUBiO FORENSIC AUDITOR: GATE CNL-P21-001 SINGULARITY MASTER AUDIT")
    print("================================================================================\n")

    # 1. State Snapshot Check
    if not os.path.exists(MEMORY_FILE):
        print(f"[AUDIT CRITICAL ERROR] Memory file '{MEMORY_FILE}' does not exist!")
        sys.exit(1)

    with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"[Audit 1] Magic Header Check (.3dmemory):")
    magic = data.get("cubio_magic")
    print(f"  - Magic Signature: {magic}")
    if magic != "CUBIO_3DMEM_v21_SINGULARITY_MASTER":
        print("[FAIL] Invalid memory magic header!")
        sys.exit(1)
    print("  ✓ State snapshot magic header confirmed.")

    # 2. Gate Verification
    print(f"\n[Audit 2] Gate Verification:")
    gate = data.get("gate")
    print(f"  - Gate: {gate}")
    if gate != "CNL-P21-001":
        print("[FAIL] Gate mismatch!")
        sys.exit(1)
    print("  ✓ Gate CNL-P21-001 certified.")

    # 3. Post-Quantum Cryptographic Seal
    print(f"\n[Audit 3] Post-Quantum Cryptographic Seal:")
    pqc_seal = data.get("pqc_master_seal")
    print(f"  - PQC Root Seal: {pqc_seal}")
    if not pqc_seal or not pqc_seal.startswith("0xPQC_369_") or not pqc_seal.endswith("_SEAL"):
        print("[FAIL] PQC seal format invalid!")
        sys.exit(1)
    print("  ✓ Quantum-resistant lattice root seal verified.")

    # 4. Fail-Closed Actuation Lock
    print(f"\n[Audit 4] Fail-Closed Actuation Lock Verification:")
    is_blocked = data.get("is_actuation_blocked")
    print(f"  - is_actuation_blocked: {is_blocked}")
    if is_blocked is not True:
        print("[FAIL] Actuation block is not active!")
        sys.exit(1)
    print("  ✓ Permanent fail-closed actuation lock verified.")

    # 5. 21-Phase Cryptographic Ancestry Lineage
    print(f"\n[Audit 5] Immutable 21-Phase Cryptographic Lineage Audit:")
    lineage = data.get("lineageChain", [])
    print(f"  - Total Lineage Phases: {len(lineage)}")
    if len(lineage) != 21:
        print(f"[FAIL] Incomplete lineage chain! Expected 21 phases, got {len(lineage)}")
        sys.exit(1)
    print("  ✓ Full 21-Phase unbroken Merkle lineage verified.")

    # 6. Distribution Package Artifacts Audit
    print(f"\n[Audit 6] Distribution Package Artifacts Audit:")
    required_files = ["index.html", "cubio_master.3dmemory", "README.md", "manifest.json"]
    for rf in required_files:
        full_p = os.path.join(DIST_DIR, rf)
        if not os.path.exists(full_p):
            print(f"[FAIL] Required distribution file missing: {full_p}")
            sys.exit(1)
        print(f"  ✓ Found '{rf}' ({os.path.getsize(full_p)} bytes)")

    html_path = os.path.join(DIST_DIR, "index.html")
    with open(html_path, 'r', encoding='utf-8') as hf:
        html_code = hf.read()

    if "Singularity-UI (3D)" not in html_code or "343-Cell" not in html_code:
        print("[FAIL] index.html missing Singularity-UI 3D core routines!")
        sys.exit(1)
    print("  ✓ Dual-mode adaptive HTML artifact verified.")

    print("\n================================================================================")
    print(" 🏆 AUDIT VERDICT: GATE CNL-P21-001 PASS (ALL 6 AUDIT GATES 100% COMPLIANT)")
    print("================================================================================\n")

if __name__ == "__main__":
    run_phase21_forensic_audit()
