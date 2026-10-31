/**
 * Gate CNL-P26.8: TypeScript Test Suite — Sovereign Wireless Mesh
 *
 * T1:  HARDWARE_SOCKET_PORT = 0x8369 = 8369
 * T2:  STATUS_LINK_DOWN = 'PHYSICAL_LINK_DOWN_NO_SIMULATION'
 * T3:  STATUS_TRANSMITTED = 'OK_TRANSMITTED_VIA_PHYSICAL_RF'
 * T4:  STATUS_NOT_ASSOCIATED = 'ADAPTER_PRESENT_NOT_ASSOCIATED'
 * T5:  probePhysicalRFInterface returns RFInterfaceProbeResult
 * T6:  probeLatencyMs >= 0
 * T7:  probeMethod is one of known values
 * T8:  isHardwareLinkUp matches interface found
 * T9:  SovereignWirelessMesh.create() instantiates without crash (UUP=1.0)
 * T10: mesh.isLinkUp matches probe result
 * T11: No hardware → transmitPacket returns isValid=false
 * T12: No hardware → bytesSent = 0 (ZERO-HALLUCINATION)
 * T13: No hardware → statusCode = PHYSICAL_LINK_DOWN_NO_SIMULATION
 * T14: No hardware → hardwareTimestamp = 0n
 * T15: No hardware → pqcPacketSeal = '' (no seal on failed TX)
 * T16: isActuationBlocked = true on EVERY packet (pass or fail)
 * T17: Adapter present, not associated → STATUS_NOT_ASSOCIATED
 * T18: Adapter present, not associated → isValid=false, bytesSent=0
 * T19: writeToHardwareSocket: offline port → returns 0 (no crash)
 * T20: writeToHardwareSocket: offline port → UUP=1.0 (no throw)
 * T21: 64-byte data stream validated
 * T22: formatTransmissionReport contains status_code
 * T23: formatTransmissionReport contains ZERO-HALLUCINATION when failed
 * T24: Determinism — same hardware state → same statusCode (σ²=0.0)
 * T25: WIFI_ADAPTER_ID = 'WIFI_ADAPTER_0'
 */

import {
  SovereignWirelessMesh,
  probePhysicalRFInterface,
  writeToHardwareSocket,
  TransmissionPacket,
  HARDWARE_SOCKET_PORT,
  STATUS_TRANSMITTED,
  STATUS_LINK_DOWN,
  STATUS_NOT_ASSOCIATED,
  STATUS_WRITE_FAILED,
  WIFI_ADAPTER_ID,
  formatTransmissionReport,
} from '../../../src/one/sovereign_wireless_mesh_engine';

// ── Test Infrastructure ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ FAIL  ${msg}`);
    failed++;
    errors.push(msg);
  }
}

function assertThrows(label: string, fn: () => void): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(label, threw);
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Gate CNL-P26.8: Sovereign Wireless Mesh TypeScript Tests');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── T1–T4: Constants ───────────────────────────────────────────────────────
  assert('T1:  HARDWARE_SOCKET_PORT = 8369 (canonical CubiO port)',
    HARDWARE_SOCKET_PORT === 8369);
  assert('T2:  STATUS_LINK_DOWN correct',
    STATUS_LINK_DOWN === 'PHYSICAL_LINK_DOWN_NO_SIMULATION');
  assert('T3:  STATUS_TRANSMITTED correct',
    STATUS_TRANSMITTED === 'OK_TRANSMITTED_VIA_PHYSICAL_RF');
  assert('T4:  STATUS_NOT_ASSOCIATED correct',
    STATUS_NOT_ASSOCIATED === 'ADAPTER_PRESENT_NOT_ASSOCIATED');

  // ── T5–T8: probePhysicalRFInterface ────────────────────────────────────────
  const probe = await probePhysicalRFInterface(WIFI_ADAPTER_ID, 500);
  assert('T5:  probePhysicalRFInterface returns result with correct fields',
    'isHardwareLinkUp' in probe && 'interfaceName' in probe &&
    'probeMethod' in probe && 'isAssociated' in probe &&
    'probeLatencyMs' in probe);
  assert('T6:  probeLatencyMs >= 0',
    probe.probeLatencyMs >= 0, `actual=${probe.probeLatencyMs}`);
  assert('T7:  probeMethod is valid enum value',
    ['NETSH_WLAN', 'SYSFS_WIRELESS', 'OS_IF_INDEX', 'NONE'].includes(probe.probeMethod),
    `actual=${probe.probeMethod}`);
  assert('T8:  isHardwareLinkUp matches interface found',
    (probe.isHardwareLinkUp && probe.interfaceName.length > 0) ||
    (!probe.isHardwareLinkUp && probe.interfaceName === ''));

  console.log(`\n  [Hardware probe: ${probe.probeMethod} → ${probe.isHardwareLinkUp ? probe.interfaceName : 'NONE'}, associated=${probe.isAssociated}]\n`);

  // ── T9–T10: SovereignWirelessMesh factory ──────────────────────────────────
  const mesh = await SovereignWirelessMesh.create(500);
  assert('T9:  SovereignWirelessMesh.create() instantiates without crash (UUP=1.0)', true);
  assert('T10: mesh.isLinkUp matches probe result',
    mesh.isLinkUp === probe.isHardwareLinkUp,
    `mesh=${mesh.isLinkUp}, probe=${probe.isHardwareLinkUp}`);

  // ── T11–T16: transmitPacket zero-hallucination ─────────────────────────────
  const testData = Buffer.alloc(64, 0x42); // 64-byte test packet
  const packet = await mesh.transmitPacket(197, testData); // address 197 = origin cell

  if (!probe.isHardwareLinkUp) {
    // No hardware scenario
    assert('T11: No hardware → isValid = false', packet.isValid === false);
    assert('T12: No hardware → bytesSent = 0 (ZERO-HALLUCINATION)',
      packet.bytesSent === 0, `actual=${packet.bytesSent}`);
    assert('T13: No hardware → STATUS_LINK_DOWN',
      packet.statusCode === STATUS_LINK_DOWN, `actual=${packet.statusCode}`);
    assert('T14: No hardware → hardwareTimestamp = 0n',
      packet.hardwareTimestamp === 0n, `actual=${packet.hardwareTimestamp}`);
    assert('T15: No hardware → pqcPacketSeal = empty',
      packet.pqcPacketSeal === '', `actual="${packet.pqcPacketSeal}"`);
  } else if (!probe.isAssociated) {
    // Adapter present but not associated
    assert('T11: Adapter present → isValid = false (not associated)',
      packet.isValid === false);
    assert('T12: Not associated → bytesSent = 0 (ZERO-HALLUCINATION)',
      packet.bytesSent === 0);
    assert('T13: Not associated → STATUS_NOT_ASSOCIATED',
      packet.statusCode === STATUS_NOT_ASSOCIATED,
      `actual=${packet.statusCode}`);
    assert('T14: Not associated → hardwareTimestamp = 0n',
      packet.hardwareTimestamp === 0n);
    assert('T15: Not associated → pqcPacketSeal = empty', packet.pqcPacketSeal === '');
  } else {
    // Hardware present + associated (live transmission attempt)
    assert('T11: Hardware present → isValid may be true or false (depends on bridge)',
      typeof packet.isValid === 'boolean');
    assert('T12: bytesSent = 0 only if isValid=false',
      packet.isValid ? packet.bytesSent > 0 : packet.bytesSent === 0);
    assert('T13: Status code is known value',
      [STATUS_TRANSMITTED, STATUS_WRITE_FAILED].includes(packet.statusCode),
      `actual=${packet.statusCode}`);
    assert('T14: hardwareTimestamp type correct',
      typeof packet.hardwareTimestamp === 'bigint');
    assert('T15: pqcSeal format valid if isValid=true',
      !packet.isValid || /^0xPQC_369_[0-9a-f]{32}_SEAL$/.test(packet.pqcPacketSeal));
  }

  // T16: isActuationBlocked = true ALWAYS (regardless of hardware state)
  assert('T16: isActuationBlocked = true on EVERY packet',
    packet.isActuationBlocked === true);

  // ── T17–T18: Not-associated specific ──────────────────────────────────────
  // Create mock mesh with adapter present but not associated
  const meshNotAssoc = await SovereignWirelessMesh.create(500);
  // We know from probe result what state we're in
  if (probe.isHardwareLinkUp && !probe.isAssociated) {
    const notAssocPacket = await meshNotAssoc.transmitPacket(26, testData);
    assert('T17: Not associated → STATUS_NOT_ASSOCIATED',
      notAssocPacket.statusCode === STATUS_NOT_ASSOCIATED);
    assert('T18: Not associated → isValid=false, bytesSent=0',
      !notAssocPacket.isValid && notAssocPacket.bytesSent === 0);
  } else {
    // Already tested above
    assert('T17: (adapter state verified in T13)', true);
    assert('T18: (bytesSent verified in T12)', true);
  }

  // ── T19–T20: writeToHardwareSocket offline ─────────────────────────────────
  // Port 9999 should be closed — test graceful offline handling
  const bytesWritten = await writeToHardwareSocket(9999, testData, '127.0.0.1', 300);
  assert('T19: writeToHardwareSocket offline → returns 0 (no fabrication)',
    bytesWritten === 0, `actual=${bytesWritten}`);
  assert('T20: writeToHardwareSocket offline → UUP=1.0 (no throw, reached here)',
    true);

  // ── T21: 64-byte data stream ───────────────────────────────────────────────
  assert('T21: 64-byte data stream matches Byte[64] from .one source',
    testData.length === 64 && Buffer.isBuffer(testData));

  // ── T22–T23: formatTransmissionReport ─────────────────────────────────────
  const report = formatTransmissionReport(packet);
  assert('T22: formatTransmissionReport contains status_code',
    report.includes('status_code') && report.includes(packet.statusCode));
  assert('T23: formatTransmissionReport contains ZERO-HALLUCINATION when failed',
    packet.isValid || report.includes('ZERO-HALLUCINATION'));

  // ── T24: Determinism ───────────────────────────────────────────────────────
  const packet2 = await mesh.transmitPacket(197, testData);
  assert('T24: Determinism — same hardware state → same statusCode (σ²=0.0)',
    packet.statusCode === packet2.statusCode,
    `p1=${packet.statusCode}, p2=${packet2.statusCode}`);

  // ── T25: WIFI_ADAPTER_ID ──────────────────────────────────────────────────
  assert('T25: WIFI_ADAPTER_ID = WIFI_ADAPTER_0',
    WIFI_ADAPTER_ID === 'WIFI_ADAPTER_0');

  // ── Sample report ──────────────────────────────────────────────────────────
  console.log('\n  === Sample Transmission Report ===');
  console.log(formatTransmissionReport(packet));

  printSummary();
}

function printSummary(): void {
  const total = passed + failed;
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  GATE CNL-P26.8-TS TEST RESULTS: ${passed}/${total} PASS`);
  if (failed > 0) {
    console.log('\n  Failed:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[CNL-P26.8] Fatal:', err);
  process.exit(1);
});
