"""
Gate CNL-P26.8: CubioHardwareBridge — Sovereign RF/Wireless Telemetry
Zero-Hallucination Physical Antenna Detection

CRITICAL FIX (over the user-submitted version):
  ❌ socket.socket() ALWAYS succeeds on any OS with a TCP/IP stack.
     It does NOT prove a physical WiFi adapter is present.
     The original code was returning True on machines with NO wireless hardware.

  ✅ This implementation uses platform-specific OS APIs to verify:
     - Windows:  'netsh wlan show interfaces' (WLAN driver query)
     - Linux:    /sys/class/net/<iface>/wireless/ sysfs path
     - macOS:    'networksetup -listallhardwareports'
     - Fallback: os.if_nameindex() + name pattern matching (wlan*, Wi-Fi*)

UUP = 1.0 Contract:
  If hardware absent → return honest zero-state, never crash, never fabricate.
  signal_strength_dbm = 0.0 ONLY when is_valid = False.
"""

import os
import re
import socket
import subprocess
import sys
import time
import platform
from typing import Optional

# ── Constants ─────────────────────────────────────────────────────────────────

STATUS_OK                    = "OK_LIVE_HARDWARE"
STATUS_UNAVAILABLE           = "PHYSICAL_MEASUREMENT_UNAVAILABLE"
STATUS_LINK_DOWN             = "PHYSICAL_LINK_DOWN_NO_SIMULATION"
STATUS_PARSE_ERROR           = "HARDWARE_RESPONSE_PARSE_ERROR"

WIFI_NAME_PATTERNS = ["wlan", "wi-fi", "wifi", "wlp", "wlan0", "wlan1"]

# ── Physical Interface Probe ───────────────────────────────────────────────────

class PhysicalInterfaceProbe:
    def __init__(self, interface_found: bool, interface_name: str,
                 probe_method: str, probe_latency_ns: int):
        self.interface_found = interface_found
        self.interface_name  = interface_name
        self.probe_method    = probe_method   # SYSFS_WIRELESS | NETSH_WLAN | NETWORKSETUP | OS_IF_INDEX | NONE
        self.probe_latency_ns = probe_latency_ns

    def __repr__(self):
        return (f"PhysicalInterfaceProbe(found={self.interface_found}, "
                f"iface='{self.interface_name}', method={self.probe_method}, "
                f"latency={self.probe_latency_ns}ns)")


def probe_sysfs_wireless() -> Optional[str]:
    """Linux: /sys/class/net/<iface>/wireless/ exists + operstate=up → real WiFi"""
    net_path = "/sys/class/net"
    if not os.path.isdir(net_path):
        return None
    try:
        for iface in os.listdir(net_path):
            wireless_path = os.path.join(net_path, iface, "wireless")
            operstate_path = os.path.join(net_path, iface, "operstate")
            if os.path.isdir(wireless_path):
                try:
                    with open(operstate_path) as f:
                        state = f.read().strip()
                    if state == "up":
                        return iface
                except OSError:
                    pass
    except OSError:
        pass
    return None


def probe_netsh_wlan() -> Optional[str]:
    """
    Windows: 'netsh wlan show interfaces' — real WLAN driver query.
    Returns interface name if WiFi ADAPTER is present (even if disconnected).
    NOTE: adapter present ≠ connected to AP. Both are honest, different states.
    """
    if platform.system() != "Windows":
        return None
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout

        # Adapter present = "Name :" line exists in output (connected OR disconnected)
        name_match = re.search(r"Name\s*:\s*(.+)", output)
        if name_match and "Name" in output:
            return name_match.group(1).strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return None


def probe_networksetup_macos() -> Optional[str]:
    """macOS: 'networksetup -listallhardwareports' to find Wi-Fi hardware."""
    if platform.system() != "Darwin":
        return None
    try:
        result = subprocess.run(
            ["networksetup", "-listallhardwareports"],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.splitlines()
        for i, line in enumerate(lines):
            if "wi-fi" in line.lower() or "airport" in line.lower():
                # Next lines contain Device: en0 etc.
                for j in range(i + 1, min(i + 4, len(lines))):
                    dev_match = re.search(r"Device:\s*(\S+)", lines[j])
                    if dev_match:
                        iface = dev_match.group(1)
                        # Verify it's up
                        link_result = subprocess.run(
                            ["ifconfig", iface],
                            capture_output=True, text=True, timeout=3
                        )
                        if "status: active" in link_result.stdout.lower():
                            return iface
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass
    return None


def probe_os_if_nameindex() -> Optional[str]:
    """
    Cross-platform fallback: os.if_nameindex() + name pattern match.
    Less reliable than sysfs/netsh but works as last resort.
    NOTE: This only proves the OS *knows* about the interface, not that
    it's physically active. Use as lowest-priority fallback only.
    """
    if not hasattr(os, "if_nameindex"):
        return None
    try:
        interfaces = os.if_nameindex()
        for _, name in interfaces:
            name_lower = name.lower()
            if any(pat in name_lower for pat in WIFI_NAME_PATTERNS):
                return name
    except OSError:
        pass
    return None


def probe_physical_antenna(interface_name: str = "Wi-Fi") -> PhysicalInterfaceProbe:
    """
    4-priority hardware probe. Returns first confirmed physical WiFi interface.

    Priority 1: Linux sysfs /sys/class/net/<iface>/wireless/ (most reliable)
    Priority 2: Windows netsh wlan show interfaces (WLAN driver)
    Priority 3: macOS networksetup -listallhardwareports
    Priority 4: OS if_nameindex pattern match (weakest — name only)
    """
    t0 = time.monotonic_ns()

    # Priority 1: Linux sysfs
    iface = probe_sysfs_wireless()
    if iface:
        return PhysicalInterfaceProbe(True, iface, "SYSFS_WIRELESS",
                                      time.monotonic_ns() - t0)

    # Priority 2: Windows netsh
    iface = probe_netsh_wlan()
    if iface:
        return PhysicalInterfaceProbe(True, iface, "NETSH_WLAN",
                                      time.monotonic_ns() - t0)

    # Priority 3: macOS networksetup
    iface = probe_networksetup_macos()
    if iface:
        return PhysicalInterfaceProbe(True, iface, "NETWORKSETUP_MACOS",
                                      time.monotonic_ns() - t0)

    # Priority 4: OS if_nameindex (weakest — pattern only)
    iface = probe_os_if_nameindex()
    if iface:
        return PhysicalInterfaceProbe(True, iface, "OS_IF_INDEX",
                                      time.monotonic_ns() - t0)

    # No physical wireless hardware confirmed — honest zero-state
    return PhysicalInterfaceProbe(False, "", "NONE", time.monotonic_ns() - t0)


# ── RF Signal Telemetry (OS Driver Read) ──────────────────────────────────────

def read_windows_signal_dbm(interface_name: str):
    """
    Windows: parse 'netsh wlan show interfaces' for Signal (%) and
    convert to approximate dBm: dBm = (signal_pct / 2) - 100.

    Returns (dbm: float, is_associated: bool) or (None, False) if unavailable.
    Adapter present but disconnected → (None, False) with STATUS_NOT_ASSOCIATED.
    """
    try:
        result = subprocess.run(
            ["netsh", "wlan", "show", "interfaces"],
            capture_output=True, text=True, timeout=5
        )
        output = result.stdout

        # Check connection state — adapter can be present but not associated
        state_match = re.search(r"State\s*:\s*(\S+)", output)
        state = state_match.group(1).strip().lower() if state_match else ""

        if state == "disconnected" or state == "":
            return None, False   # Adapter present, not associated — honest state

        signal_match = re.search(r"Signal\s*:\s*(\d+)%", output)
        if signal_match:
            pct = int(signal_match.group(1))
            # Standard approximation: dBm = (pct/2) - 100
            return float(pct // 2 - 100), True

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
        pass
    return None, False


def read_linux_signal_dbm(interface_name: str) -> Optional[float]:
    """
    Linux: read /proc/net/wireless for signal level in dBm.
    Format: iface | status | link | level | noise | ...
    """
    try:
        with open("/proc/net/wireless") as f:
            for line in f:
                if interface_name in line:
                    parts = line.split()
                    # Column 3 (0-indexed) is link quality, Column 4 is signal
                    if len(parts) >= 5:
                        level = parts[3].rstrip(".")
                        return float(level)
    except (OSError, ValueError):
        pass

    # Fallback: iwconfig (requires wireless-tools)
    try:
        result = subprocess.run(
            ["iwconfig", interface_name],
            capture_output=True, text=True, timeout=3
        )
        match = re.search(r"Signal level[=:](-?\d+)\s*dBm", result.stdout)
        if match:
            return float(match.group(1))
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        pass

    return None


# ── CubioHardwareBridge ────────────────────────────────────────────────────────

class CubioHardwareBridge:
    """
    Gate CNL-P26.8: Sovereign RF Telemetry Bridge
    Zero-Hallucination — reads from physical hardware only.

    is_actuation_blocked = True (read-only telemetry, PERMANENT)
    UUP = 1.0 (no crash when hardware absent, honest zero-state)
    σ² = 0.0 (same hardware state → same deterministic response)
    """

    def __init__(self, interface_name: str = "Wi-Fi"):
        self.interface_name = interface_name
        self._probe = probe_physical_antenna(interface_name)
        self.is_physical_active = self._probe.interface_found
        self.active_interface   = self._probe.interface_name
        self.is_actuation_blocked = True   # PERMANENT — read-only telemetry

    def read_signal_telemetry(self) -> dict:
        """
        Reads real RF signal from OS driver.
        ZERO-HALLUCINATION: signal_strength_dbm = 0.0 only when is_valid = False.
        NEVER returns fabricated dBm when hardware is absent.
        States:
          - No adapter      → STATUS_UNAVAILABLE, is_valid=False
          - Adapter present, no AP → status='ADAPTER_PRESENT_NOT_ASSOCIATED', is_valid=False
          - Connected, signal read → STATUS_OK, is_valid=True, real dBm
        """
        if not self.is_physical_active:
            return {
                "is_valid": False,
                "status": STATUS_UNAVAILABLE,
                "interface": "",
                "signal_strength_dbm": 0.0,   # NOT fabricated — genuinely absent
                "is_associated": False,
                "probe_method": self._probe.probe_method,
                "probe_latency_ns": self._probe.probe_latency_ns,
                "uup_level": 1.0,
                "is_actuation_blocked": True,
                "timestamp_ns": time.time_ns()
            }

        # Read actual signal from OS driver
        dbm: Optional[float] = None
        is_associated: bool = False

        if platform.system() == "Windows":
            dbm, is_associated = read_windows_signal_dbm(self.active_interface)
        elif platform.system() == "Linux":
            dbm = read_linux_signal_dbm(self.active_interface)
            is_associated = dbm is not None
        # macOS: would use CoreWLAN framework via subprocess

        # Adapter present but not associated to any AP
        if dbm is None and not is_associated:
            return {
                "is_valid": False,
                "status": "ADAPTER_PRESENT_NOT_ASSOCIATED",
                "interface": self.active_interface,
                "signal_strength_dbm": 0.0,   # Honest zero — not fabricated
                "is_associated": False,
                "probe_method": self._probe.probe_method,
                "probe_latency_ns": self._probe.probe_latency_ns,
                "uup_level": 1.0,
                "is_actuation_blocked": True,
                "timestamp_ns": time.time_ns()
            }

        return {
            "is_valid": True,
            "status": STATUS_OK,
            "interface": self.active_interface,
            "signal_strength_dbm": round(dbm, 2),
            "probe_method": self._probe.probe_method,
            "probe_latency_ns": self._probe.probe_latency_ns,
            "uup_level": 1.0,
            "is_actuation_blocked": True,
            "timestamp_ns": time.time_ns()
        }

    def get_probe_report(self) -> dict:
        """Returns hardware probe details without triggering a measurement."""
        return {
            "gate": "CNL-P26.8",
            "interface_found": self._probe.interface_found,
            "interface_name":  self._probe.interface_name,
            "probe_method":    self._probe.probe_method,
            "probe_latency_ns": self._probe.probe_latency_ns,
            "platform": platform.system(),
            "is_actuation_blocked": True,
            "uup": 1.0
        }


# ── Execution Entry ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("=" * 65)
    print("  Gate CNL-P26.8: Sovereign RF Telemetry Bridge")
    print("=" * 65)

    bridge = CubioHardwareBridge()

    print("\n  [PROBE REPORT]")
    probe_report = bridge.get_probe_report()
    for k, v in probe_report.items():
        print(f"    {k:<22}: {v}")

    print("\n  [SIGNAL TELEMETRY]")
    telemetry = bridge.read_signal_telemetry()
    for k, v in telemetry.items():
        print(f"    {k:<22}: {v}")

    print()
    if not telemetry["is_valid"]:
        print("  ⚠  ZERO-HALLUCINATION ENFORCED — No fabricated signal data.")
        print("     Connect a physical WiFi adapter to obtain measurements.")
    else:
        print(f"  ✅ Live RF Telemetry: {telemetry['signal_strength_dbm']} dBm "
              f"via {telemetry['interface']}")

    print("=" * 65)
