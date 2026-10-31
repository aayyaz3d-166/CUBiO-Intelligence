"""
Gate CNL-P26.10: Python Test Suite — Physical Hardware Tracker
Zero-Hallucination Bare-Metal Component Discovery

T01: PhysicalHardwareTracker instantiates without crash (UUP=1.0)
T02: is_actuation_blocked = True ALWAYS
T03: components_detected is a dict
T04: cpu_found key present
T05: memory_found key present
T06: power_sensors_found key present
T07: platform is non-empty string
T08: CPU detected (PowerShell/wmic/cpuinfo) — real hardware
T09: cpu_name is non-empty string when cpu_found=True
T10: Memory detected — real WMI/meminfo read
T11: memory_bytes > 0 when memory_found = True
T12: memory_gb > 0 when memory_found = True
T13: ORIGINAL BUG FIXED — memory_found is NOT assumed from cpu_found
T14: power_sensor_method is one of known values
T15: discover_cpu_windows / discover_cpu_linux returns (bool, str)
T16: discover_memory_windows / discover_memory_linux returns (bool, int)
T17: monitor_current_and_power_flow() returns dict without crash (UUP=1.0)
T18: is_valid field present in telemetry
T19: uup_level = 1.0 in telemetry ALWAYS
T20: is_actuation_blocked = True in telemetry ALWAYS
T21: timestamp_ns > 0 ALWAYS (clock works even without hardware)
T22: No hardware → STATUS = PHYSICAL_SENSOR_ABSENT
T23: No hardware → is_valid = False
T24: No hardware → current_amperes = 0.0 (ZERO-HALLUCINATION)
T25: No hardware → power_watts = 0.0 (ZERO-HALLUCINATION)
T26: ORIGINAL BUG FIXED — current_amperes != 12.4 (never hardcoded)
T27: ORIGINAL BUG FIXED — power_watts != 65.2 (never hardcoded)
T28: get_discovery_report() contains gate = CNL-P26.10
T29: get_discovery_report() contains is_actuation_blocked = True
T30: Determinism — two back-to-back reads have same status (σ²=0.0)
"""

import sys
import os
import platform

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'src', 'one'))

from physical_hardware_tracker import (
    PhysicalHardwareTracker,
    discover_cpu_windows,
    discover_cpu_linux,
    discover_memory_windows,
    discover_memory_linux,
    STATUS_OK,
    STATUS_ABSENT,
    OS_TYPE,
)

# ── Test Infrastructure ──────────────────────────────────────────────────────

passed = 0
failed = 0
errors = []

def assert_test(label: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        print(f"  ✅ PASS  {label}")
        passed += 1
    else:
        msg = f"{label}" + (f" — {detail}" if detail else "")
        print(f"  ❌ FAIL  {msg}")
        failed += 1
        errors.append(msg)


def run_tests() -> None:
    print('\n════════════════════════════════════════════════════════════════')
    print('  Gate CNL-P26.10: Zero-Hallucination Hardware Tracker')
    print(f'  Platform: {OS_TYPE}')
    print('════════════════════════════════════════════════════════════════\n')

    # ── T01–T02: Instantiation ────────────────────────────────────────────────
    tracker = None
    try:
        tracker = PhysicalHardwareTracker()
        assert_test('T01: PhysicalHardwareTracker instantiates without crash (UUP=1.0)', True)
    except Exception as e:
        assert_test('T01: instantiation', False, str(e))
        print_summary(); return

    assert_test('T02: is_actuation_blocked = True ALWAYS',
                tracker.is_actuation_blocked is True)

    # ── T03–T07: Component dict structure ─────────────────────────────────────
    c = tracker.components_detected
    assert_test('T03: components_detected is dict', isinstance(c, dict))
    assert_test('T04: cpu_found key present', 'cpu_found' in c)
    assert_test('T05: memory_found key present', 'memory_found' in c)
    assert_test('T06: power_sensors_found key present', 'power_sensors_found' in c)
    assert_test('T07: platform is non-empty string',
                isinstance(c.get('platform'), str) and len(c['platform']) > 0)

    # ── T08–T12: Real hardware detection ──────────────────────────────────────
    assert_test('T08: CPU detected (real OS query)',
                c['cpu_found'] is True, f"cpu_found={c['cpu_found']}")
    assert_test('T09: cpu_name non-empty when cpu_found=True',
                not c['cpu_found'] or (isinstance(c['cpu_name'], str) and len(c['cpu_name']) > 0),
                f"cpu_name='{c['cpu_name']}'")
    assert_test('T10: Memory detected (real WMI/meminfo read)',
                c['memory_found'] is True, f"memory_found={c['memory_found']}")
    assert_test('T11: memory_bytes > 0 when memory_found=True',
                not c['memory_found'] or c['memory_bytes'] > 0,
                f"memory_bytes={c['memory_bytes']}")
    report = tracker.get_discovery_report()
    assert_test('T12: memory_gb > 0 when memory_found=True',
                not c['memory_found'] or report['memory_gb'] > 0,
                f"memory_gb={report['memory_gb']}")

    # ── T13: BUG FIX — Memory not assumed from CPU ────────────────────────────
    # Original bug: `components["Memory"] = True` assumed when CPU found
    # Fix: memory is queried independently
    # If CPU found but WMI memory query returns 0 bytes, memory_found should be False
    # On this machine, BOTH are found independently
    assert_test('T13: ORIGINAL BUG FIXED — memory queried independently (not assumed from CPU)',
                # We verify this by checking memory_bytes is a REAL value (not 1 / True / assumed)
                c['memory_bytes'] > 1_000_000_000,  # must be > 1GB to be real
                f"memory_bytes={c['memory_bytes']} bytes (must be > 1 GB if real)")

    # ── T14: Sensor method enum ───────────────────────────────────────────────
    known_methods = {
        'NONE', 'RAPL_ENERGY_UJ', 'HWMON_POWER', 'LIBRE_HARDWARE_MONITOR_WMI',
        'WMI_ACPI_VOLTAGE', 'OS_IF_INDEX'
    }
    method = c['power_sensor_method']
    assert_test('T14: power_sensor_method is known value',
                method in known_methods or method.startswith('HWMON_POWER:'),
                f"actual='{method}'")

    # ── T15–T16: Discovery functions ─────────────────────────────────────────
    if OS_TYPE == "Windows":
        ok, name = discover_cpu_windows()
        assert_test('T15: discover_cpu_windows() returns (bool, str)',
                    isinstance(ok, bool) and isinstance(name, str))
        ok2, mem = discover_memory_windows()
        assert_test('T16: discover_memory_windows() returns (bool, int)',
                    isinstance(ok2, bool) and isinstance(mem, int))
    else:
        ok, name = discover_cpu_linux()
        assert_test('T15: discover_cpu_linux() returns (bool, str)',
                    isinstance(ok, bool) and isinstance(name, str))
        ok2, mem = discover_memory_linux()
        assert_test('T16: discover_memory_linux() returns (bool, int)',
                    isinstance(ok2, bool) and isinstance(mem, int))

    # ── T17–T25: Telemetry ────────────────────────────────────────────────────
    telemetry = tracker.monitor_current_and_power_flow()

    assert_test('T17: monitor_current_and_power_flow() returns dict', isinstance(telemetry, dict))
    assert_test('T18: is_valid field present', 'is_valid' in telemetry)
    assert_test('T19: uup_level = 1.0 ALWAYS',
                telemetry.get('uup_level') == 1.0,
                f"uup_level={telemetry.get('uup_level')}")
    assert_test('T20: is_actuation_blocked = True in telemetry',
                telemetry.get('is_actuation_blocked') is True)
    assert_test('T21: timestamp_ns > 0 ALWAYS',
                telemetry.get('timestamp_ns', 0) > 0)

    if not c['power_sensors_found']:
        assert_test('T22: No power sensor → STATUS_ABSENT',
                    telemetry['status'] == STATUS_ABSENT,
                    f"actual='{telemetry['status']}'")
        assert_test('T23: No power sensor → is_valid = False',
                    telemetry['is_valid'] is False)
        assert_test('T24: No power sensor → current_amperes = 0.0 (ZERO-HALLUCINATION)',
                    telemetry['current_amperes'] == 0.0,
                    f"actual={telemetry['current_amperes']}")
        assert_test('T25: No power sensor → power_watts = 0.0 (ZERO-HALLUCINATION)',
                    telemetry['power_watts'] == 0.0,
                    f"actual={telemetry['power_watts']}")
    else:
        assert_test('T22: Power sensor present → status is not ABSENT',
                    telemetry['status'] != STATUS_ABSENT)
        assert_test('T23: Telemetry has is_valid field', 'is_valid' in telemetry)
        assert_test('T24: If valid → current_amperes >= 0',
                    not telemetry['is_valid'] or telemetry['current_amperes'] >= 0,
                    f"actual={telemetry['current_amperes']}")
        assert_test('T25: If valid → power_watts >= 0',
                    not telemetry['is_valid'] or telemetry['power_watts'] >= 0,
                    f"actual={telemetry['power_watts']}")

    # ── T26–T27: Original hardcoded value BUG FIXED ───────────────────────────
    assert_test('T26: ORIGINAL BUG FIXED — current_amperes != 12.4 (never hardcoded)',
                telemetry['current_amperes'] != 12.4,
                f"actual={telemetry['current_amperes']} (12.4 was fabricated in original!)")
    assert_test('T27: ORIGINAL BUG FIXED — power_watts != 65.2 (never hardcoded)',
                telemetry['power_watts'] != 65.2,
                f"actual={telemetry['power_watts']} (65.2 was fabricated in original!)")

    # ── T28–T29: get_discovery_report ────────────────────────────────────────
    assert_test('T28: get_discovery_report() contains gate=CNL-P26.10',
                report.get('gate') == 'CNL-P26.10')
    assert_test('T29: get_discovery_report() is_actuation_blocked = True',
                report.get('is_actuation_blocked') is True)

    # ── T30: Determinism ──────────────────────────────────────────────────────
    t1 = tracker.monitor_current_and_power_flow()
    t2 = tracker.monitor_current_and_power_flow()
    assert_test('T30: Determinism — two reads have same status (σ²=0.0)',
                t1['status'] == t2['status'],
                f"t1={t1['status']}, t2={t2['status']}")

    # ── Live output ───────────────────────────────────────────────────────────
    print('\n  === Component Discovery ===')
    for k, v in report.items():
        print(f"    {k:<26}: {v}")

    print('\n  === Live Telemetry ===')
    for k, v in telemetry.items():
        print(f"    {k:<26}: {v}")

    print_summary()


def print_summary() -> None:
    total = passed + failed
    print('\n════════════════════════════════════════════════════════════════')
    print(f'  GATE CNL-P26.10 TEST RESULTS: {passed}/{total} PASS')
    if failed > 0:
        print('\n  Failed:')
        for e in errors:
            print(f'    ❌ {e}')
    print('════════════════════════════════════════════════════════════════\n')
    sys.exit(1 if failed > 0 else 0)


if __name__ == '__main__':
    run_tests()
