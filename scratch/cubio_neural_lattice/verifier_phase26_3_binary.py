#!/usr/bin/env python3
"""
Gate CNL-P26.3-BINARY: Python Forensic Verifier
Independently validates the emitted RISC-V 64 binary and .3dmemory snapshot
without using any TypeScript/Node.js tooling.

Checks:
  V1:  Binary file exists and size = 9,668 bytes
  V2:  Magic number at bytes [0..3] = 0x3690B4E0 (LE)
  V3:  Format version at [4..7] = 0x00010000
  V4:  Cell count at [8..11] = 343
  V5:  Bytes per cell at [12..15] = 28
  V6:  Data section size at [16..19] = 9,604
  V7:  Canonical address start at [20..23] = 26
  V8:  Canonical address end at [24..27] = 368
  V9:  Origin X at [28..31] = 3
  V10: Origin Y at [32..35] = 3
  V11: Origin Z at [36..39] = 3
  V12: is_actuation_blocked at [40] = 0x01
  V13: UUP byte at [41] = 0x01
  V14: Padding bytes [42..43] = 0x0000
  V15: Data section: exactly 343 × 28 = 9,604 bytes
  V16: First cell (offset 64): x=0, y=0, z=0, canonical_addr=26
  V17: Origin cell (index 171, offset 64+171*28): qprob≈1.0, collapsed=1
  V18: All 343 canonical addresses are in range [26..368]
  V19: All 343 canonical addresses are unique (no duplicates)
  V20: All is_rf_null bytes = 0x01 (UUP=1.0 safe state)
  V21: All quantum_probability values in [0.0, 1.0]
  V22: All intent_resonance values in [0.0, 1.0]
  V23: .3dmemory JSON file exists and is valid JSON
  V24: pqcBinaryRootSeal matches pattern 0xPQC_369_[0-9a-f]{32}_SEAL
  V25: pqcBinaryRootSeal ≠ compilationPqcSeal (binary seal anchored to bytecode)
  V26: Determinism check — re-derive PQC seal from binary bytes using Python SHA3-512+SHA256
  V27: constraints.isActuationBlocked = true
  V28: constraints.uup = 1.0
  V29: constraints.sigmaSq = 0.0
  V30: constraints.externalDependencies = 0
"""

import os
import sys
import json
import struct
import hashlib
import re
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Primary locations to search for the binary and snapshot
BINARY_CANDIDATES = [
    PROJECT_ROOT / 'dist' / 'bin' / 'spatial_engine.rv64.bin',
    SCRIPT_DIR / 'dist' / 'bin' / 'test_binary_emit' / 'spatial_engine.rv64.bin',
    PROJECT_ROOT / 'dist' / 'bin' / 'test_binary_emit' / 'spatial_engine.rv64.bin',
]
SNAPSHOT_CANDIDATES = [
    PROJECT_ROOT / 'cubio_spatial_binary.3dmemory',
    SCRIPT_DIR / 'cubio_spatial_binary.3dmemory',
]

# Expected constants
MAGIC = 0x3690B4E0
HEADER_SIZE = 64
BYTES_PER_CELL = 28
TOTAL_CELLS = 343
DATA_SIZE = TOTAL_CELLS * BYTES_PER_CELL  # 9,604
TOTAL_SIZE = HEADER_SIZE + DATA_SIZE       # 9,668
SALT = b'0x369_LATTICE_POLYNOMIAL_RING_SEED_v1'

# ── Test helpers ──────────────────────────────────────────────────────────────

passed = 0
failed = 0
errors = []


def check(label: str, condition: bool, detail: str = '') -> None:
    global passed, failed
    if condition:
        print(f'  ✅ PASS  {label}')
        passed += 1
    else:
        msg = f'{label}' + (f' — {detail}' if detail else '')
        print(f'  ❌ FAIL  {msg}')
        failed += 1
        errors.append(msg)


def check_approx(label: str, actual: float, expected: float, tol: float = 0.001) -> None:
    check(label, abs(actual - expected) <= tol, f'actual={actual:.6f}, expected={expected:.6f}')


def find_file(candidates):
    for p in candidates:
        if p.exists():
            return p
    return None


def pqc_seal_python(raw_bytes: bytes) -> str:
    """Replicate PQCLatticeSealEngine.generatePQCSeal() in Python."""
    lattice_core = hashlib.sha3_512(raw_bytes + SALT).digest()
    pqc_hex = hashlib.sha256(lattice_core).hexdigest()
    return f'0xPQC_369_{pqc_hex[:32]}_SEAL'


# ── Main Verifier ─────────────────────────────────────────────────────────────

def run_verifier():
    print()
    print('══════════════════════════════════════════════════════════════')
    print('  Gate CNL-P26.3-BINARY: Python Forensic Verifier')
    print('══════════════════════════════════════════════════════════════')
    print()

    # ── Locate files ──────────────────────────────────────────────────────────
    binary_path = find_file(BINARY_CANDIDATES)
    snapshot_path = find_file(SNAPSHOT_CANDIDATES)

    check('V1: Binary file exists', binary_path is not None,
          f'searched: {[str(p) for p in BINARY_CANDIDATES]}')
    if not binary_path:
        print('\n[FATAL] Binary file not found — run TypeScript tests first.\n')
        print_summary()
        return

    raw = binary_path.read_bytes()
    actual_size = len(raw)
    check('V1b: Binary file size = 9,668 bytes', actual_size == TOTAL_SIZE,
          f'actual={actual_size}')

    # ── Header checks ─────────────────────────────────────────────────────────
    magic_val, = struct.unpack_from('<I', raw, 0)
    check('V2: Magic = 0x3690B4E0', magic_val == MAGIC,
          f'actual=0x{magic_val:08X}')

    version_val, = struct.unpack_from('<I', raw, 4)
    check('V3: Format version = 0x00010000', version_val == 0x00010000,
          f'actual=0x{version_val:08X}')

    cell_count, = struct.unpack_from('<I', raw, 8)
    check('V4: Cell count = 343', cell_count == TOTAL_CELLS, f'actual={cell_count}')

    bpc, = struct.unpack_from('<I', raw, 12)
    check('V5: Bytes per cell = 28', bpc == BYTES_PER_CELL, f'actual={bpc}')

    ds_size, = struct.unpack_from('<I', raw, 16)
    check('V6: Data section size = 9,604', ds_size == DATA_SIZE, f'actual={ds_size}')

    addr_start, = struct.unpack_from('<I', raw, 20)
    check('V7: Canonical address start = 26', addr_start == 26, f'actual={addr_start}')

    addr_end, = struct.unpack_from('<I', raw, 24)
    check('V8: Canonical address end = 368', addr_end == 368, f'actual={addr_end}')

    origin_x, = struct.unpack_from('<i', raw, 28)
    origin_y, = struct.unpack_from('<i', raw, 32)
    origin_z, = struct.unpack_from('<i', raw, 36)
    check('V9:  Origin X = 3', origin_x == 3, f'actual={origin_x}')
    check('V10: Origin Y = 3', origin_y == 3, f'actual={origin_y}')
    check('V11: Origin Z = 3', origin_z == 3, f'actual={origin_z}')

    actuation_byte = raw[40]
    check('V12: is_actuation_blocked byte = 0x01', actuation_byte == 0x01,
          f'actual=0x{actuation_byte:02X}')

    uup_byte = raw[41]
    check('V13: UUP byte = 0x01', uup_byte == 0x01,
          f'actual=0x{uup_byte:02X}')

    padding = struct.unpack_from('<H', raw, 42)[0]
    check('V14: Padding bytes [42..43] = 0x0000', padding == 0x0000,
          f'actual=0x{padding:04X}')

    # ── Data section structural checks ────────────────────────────────────────
    data_section = raw[HEADER_SIZE:]
    check('V15: Data section length = 9,604', len(data_section) == DATA_SIZE,
          f'actual={len(data_section)}')

    # Parse all 343 cells
    cells = []
    for i in range(TOTAL_CELLS):
        off = i * BYTES_PER_CELL
        x, y, z, addr = struct.unpack_from('<4i', data_section, off)
        qprob, iresonance = struct.unpack_from('<2f', data_section, off + 16)
        collapsed = data_section[off + 24]
        rf_null = data_section[off + 25]
        cells.append({
            'x': x, 'y': y, 'z': z, 'addr': addr,
            'qprob': qprob, 'iresonance': iresonance,
            'collapsed': collapsed, 'rf_null': rf_null,
        })

    # V16: First cell
    c0 = cells[0]
    check('V16: First cell x=0', c0['x'] == 0, f'actual={c0["x"]}')
    check('V16: First cell y=0', c0['y'] == 0, f'actual={c0["y"]}')
    check('V16: First cell z=0', c0['z'] == 0, f'actual={c0["z"]}')
    check('V16: First cell canonical_addr=26', c0['addr'] == 26, f'actual={c0["addr"]}')

    # V17: Origin cell (index 171 = 3*49 + 3*7 + 3)
    origin_idx = 3 * 49 + 3 * 7 + 3  # 171
    oc = cells[origin_idx]
    check_approx('V17: Origin cell quantum_probability ≈ 1.0', oc['qprob'], 1.0, 0.001)
    check_approx('V17: Origin cell intent_resonance ≈ 1.0', oc['iresonance'], 1.0, 0.001)
    check('V17: Origin cell is_collapsed = 0x01', oc['collapsed'] == 0x01,
          f'actual=0x{oc["collapsed"]:02X}')

    # V18: All canonical addresses in [26..368]
    all_in_range = all(26 <= c['addr'] <= 368 for c in cells)
    check('V18: All canonical addresses in [26..368]', all_in_range,
          f'out of range: {[c["addr"] for c in cells if not (26 <= c["addr"] <= 368)]}')

    # V19: All canonical addresses unique
    all_addrs = [c['addr'] for c in cells]
    check('V19: All 343 canonical addresses unique', len(set(all_addrs)) == 343,
          f'duplicates found: {len(all_addrs) - len(set(all_addrs))}')

    # V20: All is_rf_null = 0x01 (UUP=1.0)
    all_rf_null = all(c['rf_null'] == 0x01 for c in cells)
    check('V20: All is_rf_null = 0x01 (UUP=1.0)', all_rf_null,
          f'non-null count: {sum(1 for c in cells if c["rf_null"] != 0x01)}')

    # V21: All quantum_probability in [0.0, 1.0]
    all_qprob_valid = all(0.0 <= c['qprob'] <= 1.001 for c in cells)
    check('V21: All quantum_probability in [0.0, 1.0]', all_qprob_valid)

    # V22: All intent_resonance in [0.0, 1.0]
    all_ires_valid = all(0.0 <= c['iresonance'] <= 1.001 for c in cells)
    check('V22: All intent_resonance in [0.0, 1.0]', all_ires_valid)

    # ── Snapshot checks ───────────────────────────────────────────────────────
    check('V23a: .3dmemory snapshot file exists', snapshot_path is not None,
          f'searched: {[str(p) for p in SNAPSHOT_CANDIDATES]}')

    if snapshot_path:
        try:
            snap = json.loads(snapshot_path.read_text(encoding='utf-8'))
            check('V23b: .3dmemory is valid JSON', True)

            # V24: PQC Binary Root Seal format
            brs = snap.get('pqcBinaryRootSeal', '')
            pattern = re.compile(r'^0xPQC_369_[0-9a-f]{32}_SEAL$')
            check('V24: pqcBinaryRootSeal format valid', bool(pattern.match(brs)),
                  f'actual="{brs}"')

            # V25: Binary seal ≠ compilation seal
            comp_seal = snap.get('compilationPqcSeal', '')
            check('V25: pqcBinaryRootSeal ≠ compilationPqcSeal', brs != comp_seal,
                  'seals are identical — binary not anchored to bytecode')

            # V26: Determinism — re-derive seal from raw binary bytes in Python
            derived_seal = pqc_seal_python(raw)
            check('V26: PQC Binary Root Seal deterministic (Python re-derive matches)',
                  derived_seal == brs,
                  f'derived="{derived_seal}", stored="{brs}"')

            # V27-V30: Constraints
            constraints = snap.get('constraints', {})
            check('V27: constraints.isActuationBlocked = true',
                  constraints.get('isActuationBlocked') is True)
            check('V28: constraints.uup = 1.0',
                  constraints.get('uup') == 1.0)
            check('V29: constraints.sigmaSq = 0.0',
                  constraints.get('sigmaSq') == 0.0)
            check('V30: constraints.externalDependencies = 0',
                  constraints.get('externalDependencies') == 0)

        except json.JSONDecodeError as e:
            check('V23b: .3dmemory is valid JSON', False, str(e))

    # ── Summary ───────────────────────────────────────────────────────────────
    print_summary()


def print_summary():
    total = passed + failed
    print()
    print('══════════════════════════════════════════════════════════════')
    print(f'  GATE CNL-P26.3-BINARY FORENSIC RESULTS: {passed}/{total} PASS')
    if failed > 0:
        print('\n  Failed checks:')
        for e in errors:
            print(f'    ❌ {e}')
    print('══════════════════════════════════════════════════════════════')
    print()
    sys.exit(0 if failed == 0 else 1)


if __name__ == '__main__':
    run_verifier()
