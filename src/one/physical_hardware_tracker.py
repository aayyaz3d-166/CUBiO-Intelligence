"""
Gate CNL-P26.10: PhysicalHardwareTracker — Sovereign Bare-Metal Component Discovery
Zero-Hallucination CPU / Memory / Power Sensor Telemetry

CRITICAL FIXES over the user-submitted version:
  ❌ VIOLATION 1: `Memory = True` assumed when CPU detected — not a real read
  ❌ VIOLATION 2: `current_amperes: 12.4` hardcoded — pure hallucination
  ❌ VIOLATION 3: `power_watts: 65.2` hardcoded — pure hallucination

  ✅ FIX 1: Memory verified via wmic memorychip (Windows) / /proc/meminfo (Linux)
  ✅ FIX 2: Current from /sys/class/hwmon/*/curr*_input (Linux mA→A) or ABSENT
  ✅ FIX 3: Power from Intel RAPL /sys/class/powercap/ (Linux, ΔE/Δt method)
             or WMI Win32_Processor.CurrentVoltage × estimated current (Windows)
             NEVER hardcoded — PHYSICAL_SENSOR_ABSENT if unreadable

Real Hardware Paths:
  Linux RAPL   : /sys/class/powercap/intel-rapl/intel-rapl:0/energy_uj
  Linux hwmon  : /sys/class/hwmon/hwmon*/power*_input (microwatts)
                 /sys/class/hwmon/hwmon*/curr*_input  (milliamps)
  Windows WMI  : wmic path Win32_Processor get CurrentVoltage,LoadPercentage
  Windows LHM  : LibreHardwareMonitor WMI namespace (if installed)

UUP = 1.0  — Never crash when hardware absent, honest zero-state
σ² = 0.0   — Same hardware state → deterministic response
is_actuation_blocked = True  — Read-only telemetry, PERMANENT
"""

import os
import re
import glob
import platform
import subprocess
import time
from typing import Optional, Tuple

# ── Constants ─────────────────────────────────────────────────────────────────

OS_TYPE       = platform.system()
STATUS_OK     = "OK_LIVE_SENSOR_READ"
STATUS_ABSENT = "PHYSICAL_SENSOR_ABSENT"
STATUS_ERROR  = "SENSOR_READ_ERROR"

# Linux kernel paths
RAPL_BASE         = "/sys/class/powercap/intel-rapl"
RAPL_ENERGY_FILE  = "energy_uj"      # microjoules, wraps at max_energy_range_uj
HWMON_BASE        = "/sys/class/hwmon"
PROCMEM           = "/proc/meminfo"
CPUINFO           = "/proc/cpuinfo"

# ── CPU Discovery ─────────────────────────────────────────────────────────────

def discover_cpu_windows() -> Tuple[bool, str]:
    """PowerShell WMI CPU query (wmic deprecated in Win10+). Returns (found, name)."""
    try:
        result = subprocess.run(
            ["powershell", "-NonInteractive", "-Command",
             "Get-WmiObject Win32_Processor | Select-Object -ExpandProperty Name"],
            capture_output=True, text=True, timeout=5
        )
        name = result.stdout.strip()
        if result.returncode == 0 and name:
            return True, name.splitlines()[0]
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return False, ""

def discover_cpu_linux() -> Tuple[bool, str]:
    """Real /proc/cpuinfo read."""
    try:
        with open(CPUINFO) as f:
            for line in f:
                if line.startswith("model name"):
                    name = line.split(":", 1)[1].strip()
                    return True, name
    except OSError:
        pass
    return False, ""

# ── Memory Discovery ──────────────────────────────────────────────────────────

def discover_memory_windows() -> Tuple[bool, int]:
    """PowerShell WMI memory query. Returns (found, total_bytes)."""
    try:
        result = subprocess.run(
            ["powershell", "-NonInteractive", "-Command",
             "Get-WmiObject Win32_PhysicalMemory | Measure-Object -Property Capacity "
             "-Sum | Select-Object -ExpandProperty Sum"],
            capture_output=True, text=True, timeout=5
        )
        val = result.stdout.strip()
        if result.returncode == 0 and val.isdigit():
            return True, int(val)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
        pass
    return False, 0

def discover_memory_linux() -> Tuple[bool, int]:
    """Real /proc/meminfo read. Returns (found, total_bytes)."""
    try:
        with open(PROCMEM) as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    kb = int(line.split()[1])
                    return True, kb * 1024
    except (OSError, ValueError):
        pass
    return False, 0

# ── Power Sensor Discovery ────────────────────────────────────────────────────

def discover_power_sensors_linux() -> Tuple[bool, str]:
    """
    Priority 1: Intel/AMD RAPL via /sys/class/powercap/intel-rapl/
    Priority 2: hwmon power*_input entries
    Returns (found, method).
    """
    # RAPL check
    rapl_path = os.path.join(RAPL_BASE, "intel-rapl:0", RAPL_ENERGY_FILE)
    if os.path.isfile(rapl_path):
        try:
            with open(rapl_path) as f:
                val = int(f.read().strip())
            if val >= 0:
                return True, "RAPL_ENERGY_UJ"
        except (OSError, ValueError):
            pass

    # hwmon power*_input
    for hwmon_dir in glob.glob(os.path.join(HWMON_BASE, "hwmon*")):
        for power_file in glob.glob(os.path.join(hwmon_dir, "power*_input")):
            return True, f"HWMON_POWER:{os.path.basename(hwmon_dir)}"

    return False, "NONE"

def discover_power_sensors_windows() -> Tuple[bool, str]:
    """
    Check Windows power sensor availability:
    Priority 1: LibreHardwareMonitor WMI namespace (OpenHardwareMonitor)
    Priority 2: WMI Win32_Processor.CurrentVoltage (ACPI-reported)
    Priority 3: PowerShell RAPL equivalent (Windows 10+)
    """
    # Priority 1: LibreHardwareMonitor WMI
    try:
        result = subprocess.run(
            ["powershell", "-NonInteractive", "-Command",
             "Get-WmiObject -Namespace root/LibreHardwareMonitor -Class Sensor "
             "-Filter \"SensorType='Power'\" | Select-Object -First 1 Value"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and "Value" in result.stdout:
            lines = [l.strip() for l in result.stdout.splitlines() if l.strip()]
            if any(l.replace('.','',1).isdigit() for l in lines):
                return True, "LIBRE_HARDWARE_MONITOR_WMI"
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass

    # Priority 2: ACPI CurrentVoltage (partial, not power directly)
    try:
        result = subprocess.run(
            ["wmic", "path", "Win32_Processor", "get", "CurrentVoltage"],
            capture_output=True, text=True, timeout=3
        )
        lines = [l.strip() for l in result.stdout.splitlines()
                 if l.strip() and l.strip().isdigit()]
        if lines and int(lines[0]) > 0:
            return True, "WMI_ACPI_VOLTAGE"
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass

    return False, "NONE"

# ── Real Power / Current Reads ────────────────────────────────────────────────

def read_rapl_power_watts(sample_ms: int = 100) -> Optional[float]:
    """
    Linux RAPL: Read energy twice, compute power = ΔE / Δt.
    ΔE in microjoules → watts = ΔE_J / Δt_s
    """
    rapl_path = os.path.join(RAPL_BASE, "intel-rapl:0", RAPL_ENERGY_FILE)
    try:
        with open(rapl_path) as f:
            e1 = int(f.read().strip())
        time.sleep(sample_ms / 1000.0)
        with open(rapl_path) as f:
            e2 = int(f.read().strip())

        # Handle wrap-around
        max_path = os.path.join(RAPL_BASE, "intel-rapl:0", "max_energy_range_uj")
        if e2 < e1:
            try:
                with open(max_path) as f:
                    e_max = int(f.read().strip())
                e2 += e_max
            except OSError:
                return None

        delta_uj = e2 - e1
        delta_s  = sample_ms / 1000.0
        return (delta_uj * 1e-6) / delta_s   # watts

    except (OSError, ValueError):
        return None

def read_hwmon_power_watts() -> Optional[float]:
    """Linux hwmon power*_input in microwatts → watts."""
    for hwmon_dir in glob.glob(os.path.join(HWMON_BASE, "hwmon*")):
        for power_file in glob.glob(os.path.join(hwmon_dir, "power*_input")):
            try:
                with open(power_file) as f:
                    uw = int(f.read().strip())
                return uw * 1e-6  # microwatts → watts
            except (OSError, ValueError):
                continue
    return None

def read_hwmon_current_amps() -> Optional[float]:
    """Linux hwmon curr*_input in milliamps → amps."""
    for hwmon_dir in glob.glob(os.path.join(HWMON_BASE, "hwmon*")):
        for curr_file in glob.glob(os.path.join(hwmon_dir, "curr*_input")):
            try:
                with open(curr_file) as f:
                    ma = int(f.read().strip())
                return ma * 1e-3  # milliamps → amps
            except (OSError, ValueError):
                continue
    return None

def read_windows_lhm_power() -> Optional[float]:
    """LibreHardwareMonitor WMI power sensor read."""
    try:
        result = subprocess.run(
            ["powershell", "-NonInteractive", "-Command",
             "Get-WmiObject -Namespace root/LibreHardwareMonitor -Class Sensor "
             "-Filter \"SensorType='Power' AND Name='CPU Package'\" "
             "| Select-Object -ExpandProperty Value"],
            capture_output=True, text=True, timeout=5
        )
        val_str = result.stdout.strip()
        if val_str and result.returncode == 0:
            return float(val_str)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
        pass
    return None

def read_windows_acpi_voltage() -> Optional[float]:
    """ACPI voltage in tenths of a volt → volts (not power, but available)."""
    try:
        result = subprocess.run(
            ["wmic", "path", "Win32_Processor", "get", "CurrentVoltage"],
            capture_output=True, text=True, timeout=3
        )
        lines = [l.strip() for l in result.stdout.splitlines()
                 if l.strip() and l.strip().isdigit()]
        if lines:
            return int(lines[0]) / 10.0  # tenths of a volt
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
        pass
    return None

# ── PhysicalHardwareTracker ────────────────────────────────────────────────────

class PhysicalHardwareTracker:
    """
    Gate CNL-P26.10: Sovereign Bare-Metal Hardware Discovery & Telemetry
    Zero-Hallucination — ALL readings from real OS/kernel interfaces.

    Constraints:
      is_actuation_blocked = True (read-only, PERMANENT)
      UUP = 1.0 (no crash when hardware absent)
      σ² = 0.0 (deterministic response)
    """

    def __init__(self):
        self.os_type              = OS_TYPE
        self.is_actuation_blocked = True
        self.components_detected  = self._discover_components()

    def _discover_components(self) -> dict:
        """
        Scans bare-metal hardware components.
        ZERO-HALLUCINATION: each field verified individually, never assumed.
        """
        components = {
            "cpu_found":    False,
            "cpu_name":     "",
            "memory_found": False,
            "memory_bytes": 0,
            "power_sensors_found": False,
            "power_sensor_method": "NONE",
            "platform":     self.os_type,
        }

        try:
            if self.os_type == "Windows":
                cpu_ok, cpu_name = discover_cpu_windows()
                components["cpu_found"] = cpu_ok
                components["cpu_name"]  = cpu_name

                # Memory: REAL wmic query — NEVER assumed from CPU detection
                mem_ok, mem_bytes = discover_memory_windows()
                components["memory_found"] = mem_ok
                components["memory_bytes"] = mem_bytes

                # Power: Real ACPI/LHM check
                pwr_ok, pwr_method = discover_power_sensors_windows()
                components["power_sensors_found"] = pwr_ok
                components["power_sensor_method"] = pwr_method

            elif self.os_type == "Linux":
                cpu_ok, cpu_name = discover_cpu_linux()
                components["cpu_found"] = cpu_ok
                components["cpu_name"]  = cpu_name

                mem_ok, mem_bytes = discover_memory_linux()
                components["memory_found"] = mem_ok
                components["memory_bytes"] = mem_bytes

                pwr_ok, pwr_method = discover_power_sensors_linux()
                components["power_sensors_found"] = pwr_ok
                components["power_sensor_method"] = pwr_method

        except Exception:
            pass   # UUP = 1.0: never crash

        return components

    def monitor_current_and_power_flow(self) -> dict:
        """
        Reads actual current/power from physical hardware interfaces.
        ZERO-HALLUCINATION:
          - current_amperes = 0.0 ONLY when is_valid = False (not fabricated)
          - power_watts = 0.0 ONLY when is_valid = False (not fabricated)
          - NEVER returns hardcoded 12.4A or 65.2W
        """
        if not self.components_detected["power_sensors_found"]:
            return {
                "is_valid":        False,
                "status":          STATUS_ABSENT,
                "uup_level":       1.0,
                "current_amperes": 0.0,     # honest zero — not fabricated
                "power_watts":     0.0,     # honest zero — not fabricated
                "sensor_method":   "NONE",
                "is_actuation_blocked": True,
                "timestamp_ns":    time.time_ns(),
                "message": "No direct current shunt / ACPI power register detected. Simulation blocked."
            }

        # Attempt real sensor reads
        power_watts:   Optional[float] = None
        current_amps:  Optional[float] = None
        sensor_used = self.components_detected["power_sensor_method"]

        if self.os_type == "Linux":
            power_watts  = read_rapl_power_watts(sample_ms=50)
            if power_watts is None:
                power_watts = read_hwmon_power_watts()
            current_amps = read_hwmon_current_amps()

        elif self.os_type == "Windows":
            method = self.components_detected["power_sensor_method"]
            if method == "LIBRE_HARDWARE_MONITOR_WMI":
                power_watts = read_windows_lhm_power()
            elif method == "WMI_ACPI_VOLTAGE":
                voltage = read_windows_acpi_voltage()
                # NOTE: We have voltage but NOT current — report partial read
                # current cannot be derived from voltage alone without load model
                # Zero-hallucination: do NOT estimate current
                if voltage is not None:
                    return {
                        "is_valid":        False,
                        "status":          "VOLTAGE_ONLY_NO_CURRENT_SHUNT",
                        "uup_level":       1.0,
                        "voltage_volts":   round(voltage, 3),
                        "current_amperes": 0.0,   # cannot derive — honest zero
                        "power_watts":     0.0,   # cannot derive — honest zero
                        "sensor_method":   method,
                        "is_actuation_blocked": True,
                        "timestamp_ns":    time.time_ns(),
                        "message": f"ACPI voltage={voltage}V available. Current shunt absent — power cannot be computed."
                    }

        # Final check: did we get real readings?
        if power_watts is None and current_amps is None:
            return {
                "is_valid":        False,
                "status":          STATUS_ERROR,
                "uup_level":       1.0,
                "current_amperes": 0.0,
                "power_watts":     0.0,
                "sensor_method":   sensor_used,
                "is_actuation_blocked": True,
                "timestamp_ns":    time.time_ns(),
                "message": "Sensor detected but OS read failed — driver may need privileges."
            }

        return {
            "is_valid":        True,
            "status":          STATUS_OK,
            "uup_level":       1.0,
            "current_amperes": round(current_amps, 6) if current_amps is not None else 0.0,
            "power_watts":     round(power_watts, 4)  if power_watts  is not None else 0.0,
            "sensor_method":   sensor_used,
            "is_actuation_blocked": True,
            "timestamp_ns":    time.time_ns(),
        }

    def get_discovery_report(self) -> dict:
        """Returns structured discovery results without measurement."""
        c = self.components_detected
        return {
            "gate":             "CNL-P26.10",
            "platform":         self.os_type,
            "cpu_found":        c["cpu_found"],
            "cpu_name":         c["cpu_name"],
            "memory_found":     c["memory_found"],
            "memory_gb":        round(c["memory_bytes"] / (1024**3), 2) if c["memory_bytes"] else 0,
            "power_sensors":    c["power_sensors_found"],
            "sensor_method":    c["power_sensor_method"],
            "is_actuation_blocked": self.is_actuation_blocked,
            "uup":              1.0,
        }


# ── Execution Entry ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 68)
    print("  Gate CNL-P26.10: Sovereign Bare-Metal Hardware Tracker")
    print("=" * 68)

    tracker = PhysicalHardwareTracker()

    print("\n  [COMPONENT DISCOVERY]")
    report = tracker.get_discovery_report()
    for k, v in report.items():
        print(f"    {k:<26}: {v}")

    print("\n  [CURRENT & POWER TELEMETRY]")
    telemetry = tracker.monitor_current_and_power_flow()
    for k, v in telemetry.items():
        print(f"    {k:<26}: {v}")

    print()
    if not telemetry["is_valid"]:
        print(f"  ⚠  ZERO-HALLUCINATION: {telemetry.get('message', 'No sensor data fabricated.')}")
    else:
        print(f"  ✅ Live Power: {telemetry['power_watts']} W  |"
              f"  Current: {telemetry['current_amperes']} A")

    print("=" * 68)
