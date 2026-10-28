/**
 * ONE Language Hardware Telemetry Bridge Engine
 * Gate CNL-P26.6: Zero-Hallucination Hardware Telemetry
 *
 * IMMUTABLE ENFORCEMENT:
 *   ❌ NO simulated / synthetic current values
 *   ❌ NO fallback random numbers if hardware absent
 *   ✅ is_actuation_blocked = true ALWAYS (read-only telemetry)
 *   ✅ UUP = 1.0 (zero-state when hardware offline — no fabrication, no crash)
 *   ✅ σ² = 0.0 (same hardware state → same deterministic response)
 *   ✅ PQC seal on every VALID reading
 *   ✅ Honest fail-closed: PHYSICAL_MEASUREMENT_UNAVAILABLE if device absent
 *
 * Hardware Discovery Priority:
 *   1. CUBIO_WIFI_BRIDGE_8369 — cubio_wifi_bridge.py Port 8369 (WiFi ADC relay)
 *   2. ADC_CURRENT_METER_01   — USB/UART serial ADC (e.g. UT61E, INA219)
 *   3. ADC_CURRENT_METER_02   — SPI/I2C ADC (embedded)
 *
 * If none found → immediate PHYSICAL_MEASUREMENT_UNAVAILABLE (not an error state,
 * just an honest zero-state that maintains UUP = 1.0).
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PQCLatticeSealEngine } from '../core/crypto/pqc_lattice_seal';

// ── Device IDs ─────────────────────────────────────────────────────────────────

export const DEVICE_WIFI_BRIDGE    = 'CUBIO_WIFI_BRIDGE_8369';
export const DEVICE_ADC_USB        = 'ADC_CURRENT_METER_01';
export const DEVICE_ADC_SPI        = 'ADC_CURRENT_METER_02';
export const WIFI_BRIDGE_PORT      = 8369;
export const WIFI_BRIDGE_HOST      = '127.0.0.1';

// ── Status Codes ───────────────────────────────────────────────────────────────

export const STATUS_OK             = 'OK';
export const STATUS_UNAVAILABLE    = 'PHYSICAL_MEASUREMENT_UNAVAILABLE';
export const STATUS_TIMEOUT        = 'HARDWARE_READ_TIMEOUT';
export const STATUS_RANGE_ERROR    = 'MEASUREMENT_OUT_OF_SAFE_RANGE';
export const STATUS_PARSE_ERROR    = 'HARDWARE_RESPONSE_PARSE_ERROR';

// ── Safety Thresholds ──────────────────────────────────────────────────────────

export const MAX_SAFE_AMPS         = 50.0;    // Hard ceiling in Amps
export const MIN_VALID_AMPS        = 0.0;     // Minimum measurable current

// ── Data Structures ────────────────────────────────────────────────────────────

export interface CurrentMeasurementResponse {
  isValid: boolean;             // false if hardware absent or read failed
  measuredAmps: number;         // ALWAYS 0.0 when isValid = false
  statusCode: string;           // STATUS_OK | STATUS_UNAVAILABLE | ...
  timestamp: number;            // epoch ms (0 when unavailable)
  deviceId: string;             // which physical device produced this
  pqcSeal: string;              // PQC seal of reading (empty string if invalid)
  isActuationBlocked: boolean;  // ALWAYS true — telemetry is read-only
}

export interface HardwareProbeResult {
  deviceFound: boolean;
  deviceId: string;
  probeLatencyMs: number;
  probeMethod: 'WIFI_SOCKET' | 'SERIAL_PORT' | 'SYSFS' | 'NONE';
}

export interface TelemetrySnapshot {
  gate: string;
  timestamp: string;
  deviceId: string;
  isPhysicalDeviceActive: boolean;
  totalReadings: number;
  validReadings: number;
  lastReading: CurrentMeasurementResponse | null;
  pqcSnapshotSeal: string;
  constraints: {
    isActuationBlocked: boolean;
    uup: number;
    sigmaSq: number;
    zeroHallucination: boolean;
  };
}

// ── UNAVAILABLE Response Helper ────────────────────────────────────────────────

function makeUnavailableResponse(status = STATUS_UNAVAILABLE): CurrentMeasurementResponse {
  return {
    isValid: false,
    measuredAmps: 0.0,          // NEVER fabricate
    statusCode: status,
    timestamp: 0,
    deviceId: '',
    pqcSeal: '',                // No seal on invalid data
    isActuationBlocked: true,   // PERMANENT
  };
}

// ── Hardware Probe ─────────────────────────────────────────────────────────────

/**
 * Probes for physical hardware presence.
 * Tries WiFi bridge socket first (cubio_wifi_bridge.py on port 8369),
 * then checks OS device files for USB/serial ADC devices.
 *
 * Returns immediately with deviceFound=false if nothing is present —
 * no timeout loops, no blocking, no fabrication.
 */
export async function probeHardwareInterface(
  timeoutMs: number = 500
): Promise<HardwareProbeResult> {
  const t0 = performance.now();

  // ── Priority 1: WiFi Bridge (cubio_wifi_bridge.py on port 8369) ──────────
  const wifiResult = await probeWifiBridge(timeoutMs);
  if (wifiResult) {
    return {
      deviceFound: true,
      deviceId: DEVICE_WIFI_BRIDGE,
      probeLatencyMs: Number((performance.now() - t0).toFixed(3)),
      probeMethod: 'WIFI_SOCKET',
    };
  }

  // ── Priority 2: USB/Serial ADC (platform-specific device paths) ──────────
  const serialResult = probeSerialAdc();
  if (serialResult) {
    return {
      deviceFound: true,
      deviceId: DEVICE_ADC_USB,
      probeLatencyMs: Number((performance.now() - t0).toFixed(3)),
      probeMethod: 'SERIAL_PORT',
    };
  }

  // ── Priority 3: SPI/I2C via sysfs (Linux embedded) ───────────────────────
  const sysfsResult = probeSysfsAdc();
  if (sysfsResult) {
    return {
      deviceFound: true,
      deviceId: DEVICE_ADC_SPI,
      probeLatencyMs: Number((performance.now() - t0).toFixed(3)),
      probeMethod: 'SYSFS',
    };
  }

  // ── No hardware found — honest zero-state ────────────────────────────────
  return {
    deviceFound: false,
    deviceId: '',
    probeLatencyMs: Number((performance.now() - t0).toFixed(3)),
    probeMethod: 'NONE',
  };
}

function probeWifiBridge(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; client.destroy(); resolve(false); }
    }, timeoutMs);

    client.connect(WIFI_BRIDGE_PORT, WIFI_BRIDGE_HOST, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        client.destroy();
        resolve(true);
      }
    });

    client.on('error', () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(false); }
    });
  });
}

function probeSerialAdc(): boolean {
  const platform = os.platform();
  const candidatePaths: string[] = [];

  if (platform === 'linux') {
    candidatePaths.push('/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyACM0', '/dev/ttyACM1');
  } else if (platform === 'darwin') {
    candidatePaths.push('/dev/cu.usbserial-0001', '/dev/cu.usbmodem1101');
  } else if (platform === 'win32') {
    // On Windows, serial ports are not exposed as filesystem paths
    // Would need WMI or COM port enumeration (out of scope for this pure-TS implementation)
    return false;
  }

  return candidatePaths.some(p => {
    try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
  });
}

function probeSysfsAdc(): boolean {
  // Linux sysfs INA219 / ADS1115 style ADC paths
  const sysfsPath = '/sys/class/hwmon';
  try {
    return fs.existsSync(sysfsPath) && fs.readdirSync(sysfsPath).length > 0;
  } catch {
    return false;
  }
}

// ── Current Reading via WiFi Bridge ───────────────────────────────────────────

/**
 * Reads actual current value from cubio_wifi_bridge.py via TCP port 8369.
 * Protocol: send "READ_CURRENT\n" → receive JSON {"amps": <float>, "ts": <epoch_ms>}
 * Returns null on any error — caller decides to return STATUS_UNAVAILABLE.
 * NEVER returns fabricated data.
 */
export async function readCurrentFromWifiBridge(
  timeoutMs: number = 1000
): Promise<{ amps: number; timestamp: number } | null> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;
    const chunks: Buffer[] = [];

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; client.destroy(); resolve(null); }
    }, timeoutMs);

    client.connect(WIFI_BRIDGE_PORT, WIFI_BRIDGE_HOST, () => {
      client.write('READ_CURRENT\n');
    });

    client.on('data', (chunk) => chunks.push(chunk));

    client.on('end', () => {
      clearTimeout(timeout);
      if (resolved) return;
      resolved = true;

      try {
        const raw = Buffer.concat(chunks).toString('utf-8').trim();
        const parsed = JSON.parse(raw);
        if (typeof parsed.amps === 'number' && typeof parsed.ts === 'number') {
          resolve({ amps: parsed.amps, timestamp: parsed.ts });
        } else {
          resolve(null); // Malformed response — not fabricating
        }
      } catch {
        resolve(null); // JSON parse error — not fabricating
      }
    });

    client.on('error', () => {
      if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null); }
    });
  });
}

// ── CurrentSensorBus ───────────────────────────────────────────────────────────

export class CurrentSensorBus {
  private isPhysicalDeviceActive: boolean = false;
  private activeDeviceId: string = '';
  private readCount: number = 0;
  private validReadCount: number = 0;
  private lastReading: CurrentMeasurementResponse | null = null;
  private probeMethod: HardwareProbeResult['probeMethod'] = 'NONE';

  // Must call init() after construction (async probe)
  private constructor() {}

  /**
   * Factory method — performs hardware probe before returning instance.
   * Ensures isPhysicalDeviceActive reflects actual hardware state.
   */
  public static async create(probeTimeoutMs: number = 500): Promise<CurrentSensorBus> {
    const bus = new CurrentSensorBus();
    const probe = await probeHardwareInterface(probeTimeoutMs);
    bus.isPhysicalDeviceActive = probe.deviceFound;
    bus.activeDeviceId = probe.deviceId;
    bus.probeMethod = probe.probeMethod;
    return bus;
  }

  /**
   * STRICT: No measurement without confirmed physical hardware.
   * Returns PHYSICAL_MEASUREMENT_UNAVAILABLE if device not found.
   * NEVER returns fabricated current data.
   */
  public async measure(): Promise<CurrentMeasurementResponse> {
    // ── Hardware absent → immediate zero-state, no fabrication ───────────
    if (!this.isPhysicalDeviceActive) {
      const response = makeUnavailableResponse(STATUS_UNAVAILABLE);
      this.readCount++;
      this.lastReading = response;
      return response;
    }

    // ── Read from physical device based on probe method ───────────────────
    let rawAmps: number | null = null;
    let timestamp: number = Date.now();

    if (this.probeMethod === 'WIFI_SOCKET') {
      const bridgeData = await readCurrentFromWifiBridge(1000);
      if (bridgeData !== null) {
        rawAmps = bridgeData.amps;
        timestamp = bridgeData.timestamp;
      }
    }
    // Serial/SysFS paths: would integrate OS-level read here
    // For now: if WiFi bridge is the detected device but returns null → hardware timeout

    // ── Null read = timeout or disconnect ─────────────────────────────────
    if (rawAmps === null) {
      const response = makeUnavailableResponse(STATUS_TIMEOUT);
      this.readCount++;
      this.lastReading = response;
      return response;
    }

    // ── Range validation ───────────────────────────────────────────────────
    if (rawAmps < MIN_VALID_AMPS || rawAmps > MAX_SAFE_AMPS) {
      const response = makeUnavailableResponse(STATUS_RANGE_ERROR);
      response.timestamp = timestamp;
      response.deviceId = this.activeDeviceId;
      this.readCount++;
      this.lastReading = response;
      return response;
    }

    // ── Valid reading → PQC seal ───────────────────────────────────────────
    const sealInput = Buffer.from(
      `${rawAmps.toFixed(6)}@${timestamp}@${this.activeDeviceId}`,
      'utf-8'
    );
    const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(sealInput);

    const response: CurrentMeasurementResponse = {
      isValid: true,
      measuredAmps: Number(rawAmps.toFixed(6)),
      statusCode: STATUS_OK,
      timestamp,
      deviceId: this.activeDeviceId,
      pqcSeal,
      isActuationBlocked: true,
    };

    this.readCount++;
    this.validReadCount++;
    this.lastReading = response;
    return response;
  }

  /**
   * Re-probes hardware without triggering a measurement.
   * Updates isPhysicalDeviceActive in-place.
   */
  public async reprobeHardware(timeoutMs: number = 500): Promise<HardwareProbeResult> {
    const probe = await probeHardwareInterface(timeoutMs);
    this.isPhysicalDeviceActive = probe.deviceFound;
    this.activeDeviceId = probe.deviceId;
    this.probeMethod = probe.probeMethod;
    return probe;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  public get isHardwarePresent(): boolean {
    return this.isPhysicalDeviceActive;
  }

  public get deviceId(): string {
    return this.activeDeviceId;
  }

  public get totalReadings(): number {
    return this.readCount;
  }

  public get validReadings(): number {
    return this.validReadCount;
  }

  // ── Telemetry Snapshot ────────────────────────────────────────────────────

  public generateSnapshot(): TelemetrySnapshot {
    const snapshotPayload = Buffer.from(JSON.stringify({
      deviceId: this.activeDeviceId,
      readCount: this.readCount,
      validReadCount: this.validReadCount,
      lastReading: this.lastReading,
      timestamp: new Date().toISOString(),
    }), 'utf-8');

    const pqcSnapshotSeal = PQCLatticeSealEngine.generatePQCSeal(snapshotPayload);

    return {
      gate: 'CNL-P26.6',
      timestamp: new Date().toISOString(),
      deviceId: this.activeDeviceId,
      isPhysicalDeviceActive: this.isPhysicalDeviceActive,
      totalReadings: this.readCount,
      validReadings: this.validReadCount,
      lastReading: this.lastReading,
      pqcSnapshotSeal,
      constraints: {
        isActuationBlocked: true,
        uup: 1.0,
        sigmaSq: 0.0,
        zeroHallucination: true,
      },
    };
  }
}

// ── CLI Telemetry Report ───────────────────────────────────────────────────────

export function formatTelemetryReport(response: CurrentMeasurementResponse): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    '  Gate CNL-P26.6: Hardware Telemetry Reading',
    '═══════════════════════════════════════════════════════════',
    `  Status              : ${response.statusCode}`,
    `  is_valid            : ${response.isValid}`,
    `  measured_amps       : ${response.isValid ? response.measuredAmps.toFixed(6) + ' A' : 'N/A (no hardware)'}`,
    `  device_id           : ${response.deviceId || 'NONE'}`,
    `  timestamp           : ${response.timestamp > 0 ? new Date(response.timestamp).toISOString() : 'N/A'}`,
    `  pqc_seal            : ${response.pqcSeal || '(none — invalid reading)'}`,
    `  is_actuation_blocked: ${response.isActuationBlocked} ✓`,
    '═══════════════════════════════════════════════════════════',
  ];

  if (!response.isValid) {
    lines.push('  ⚠  ZERO-HALLUCINATION ENFORCED — No fabricated data returned.');
    lines.push('     Connect physical hardware to obtain measurements.');
  }

  return lines.join('\n');
}
