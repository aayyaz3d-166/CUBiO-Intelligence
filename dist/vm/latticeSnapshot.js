/**
 * ONE Language & CubiO Spatial VM — Phase 3
 * Module: Persistent Lattice Snapshot Engine (latticeSnapshot.ts)
 *
 * Implements deterministic serialization and deserialization of the full
 * 7×7×7 spatial memory lattice to/from a compact binary format:
 *
 *  Header (16 bytes):
 *    [0..3]   Magic: 0x4F4E4531 ('ONE1')
 *    [4..7]   Total cells written (uint32LE)
 *    [8..11]  Snapshot timestamp (uint32LE, seconds since epoch)
 *    [12..15] Checksum: FNV-1a 32-bit over payload bytes
 *
 *  Per-occupied-cell record:
 *    [0..1]   cellIndex uint16LE   (0..342)
 *    [2]      shellRadius uint8    (0..3)
 *    [3]      quantizationBits uint8 (2, 4, 8 or 0=none)
 *    [4]      dataLength uint8     (0..255)
 *    [5]      bitDensity: float32 encoded as uint16LE fixed point (0..65535 = 0.0..1.0)
 *    [7]      entropyScore: float32 encoded as uint16LE fixed point (0..65535 = 0.0..2.0)
 *    [9..9+dataLength-1]  raw data bytes
 */
import { GridMemory } from './gridMemory';
export class LatticeSnapshotEngine {
    static MAGIC = 0x4f4e4531; // 'ONE1'
    static HEADER_SIZE = 16;
    // -------------------------------------------------------------------------
    // FNV-1a 32-bit checksum
    // -------------------------------------------------------------------------
    static fnv1a32(data) {
        let hash = 0x811c9dc5; // FNV offset basis
        for (let i = 0; i < data.length; i++) {
            hash ^= data[i];
            // Multiply by FNV prime 0x01000193, keep lower 32 bits
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash >>> 0;
    }
    // -------------------------------------------------------------------------
    // Fixed-point encoding: float [0..maxVal] -> uint16LE [0..65535]
    // -------------------------------------------------------------------------
    static encodeFixed16(value, maxVal) {
        return Math.round((Math.max(0, Math.min(maxVal, value)) / maxVal) * 65535) >>> 0;
    }
    static decodeFixed16(encoded, maxVal) {
        return (encoded / 65535) * maxVal;
    }
    // -------------------------------------------------------------------------
    // Serialize GridMemory -> Uint8Array
    // -------------------------------------------------------------------------
    serialize(memory) {
        const stats = memory.getStats();
        const occupiedCount = stats.occupiedCells;
        // Build payload
        const payloadParts = [];
        for (let r = 0; r <= 3; r++) {
            for (const idx of memory.getShellIndices(r)) {
                const coord = GridMemory.indexToCoord(idx);
                const cell = memory.getCell(coord);
                if (!cell.occupied || !cell.data)
                    continue;
                const dataLen = Math.min(cell.data.byteLength, 255);
                const rec = new Uint8Array(9 + dataLen);
                const view = new DataView(rec.buffer);
                view.setUint16(0, idx, true); // cellIndex
                view.setUint8(2, cell.shellRadius); // shellRadius
                view.setUint8(3, cell.quantizationBits ?? 0); // quantizationBits
                view.setUint8(4, dataLen); // dataLength
                view.setUint16(5, LatticeSnapshotEngine.encodeFixed16(cell.bitDensity, 1.0), true); // bitDensity
                view.setUint16(7, LatticeSnapshotEngine.encodeFixed16(cell.entropyScore, 2.0), true); // entropyScore
                rec.set(cell.data.subarray(0, dataLen), 9); // payload
                payloadParts.push(rec);
            }
        }
        // Flatten payload
        const payloadSize = payloadParts.reduce((sum, p) => sum + p.byteLength, 0);
        const payload = new Uint8Array(payloadSize);
        let offset = 0;
        for (const part of payloadParts) {
            payload.set(part, offset);
            offset += part.byteLength;
        }
        // Build header
        const buffer = new Uint8Array(LatticeSnapshotEngine.HEADER_SIZE + payloadSize);
        const hdr = new DataView(buffer.buffer);
        const now = Math.floor(Date.now() / 1000);
        const checksum = LatticeSnapshotEngine.fnv1a32(payload);
        hdr.setUint32(0, LatticeSnapshotEngine.MAGIC, false); // magic (big-endian)
        hdr.setUint32(4, occupiedCount, true); // cell count
        hdr.setUint32(8, now, true); // timestamp
        hdr.setUint32(12, checksum, true); // checksum
        buffer.set(payload, LatticeSnapshotEngine.HEADER_SIZE);
        const metadata = {
            magic: 'ONE1',
            totalCellsWritten: occupiedCount,
            timestamp: now,
            checksum,
            byteSize: buffer.byteLength,
        };
        return { buffer, metadata };
    }
    // -------------------------------------------------------------------------
    // Deserialize Uint8Array -> GridMemory (rehydrate lattice state)
    // -------------------------------------------------------------------------
    deserialize(buffer) {
        if (buffer.byteLength < LatticeSnapshotEngine.HEADER_SIZE) {
            throw new Error('Snapshot buffer too small to contain header');
        }
        const hdr = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const magic = hdr.getUint32(0, false);
        if (magic !== LatticeSnapshotEngine.MAGIC) {
            throw new Error(`Invalid snapshot magic: 0x${magic.toString(16)} (expected 0x4f4e4531 'ONE1')`);
        }
        const totalCells = hdr.getUint32(4, true);
        const timestamp = hdr.getUint32(8, true);
        const storedChecksum = hdr.getUint32(12, true);
        // Verify checksum
        const payload = buffer.slice(LatticeSnapshotEngine.HEADER_SIZE);
        const computedChecksum = LatticeSnapshotEngine.fnv1a32(payload);
        const valid = storedChecksum === computedChecksum;
        // Restore memory lattice
        const memory = new GridMemory();
        let pos = 0;
        while (pos < payload.byteLength) {
            if (pos + 9 > payload.byteLength)
                break;
            const recView = new DataView(payload.buffer, payload.byteOffset + pos);
            const cellIndex = recView.getUint16(0, true);
            const shellRadius = recView.getUint8(2);
            const quantBits = recView.getUint8(3);
            const dataLen = recView.getUint8(4);
            const bitDensity = LatticeSnapshotEngine.decodeFixed16(recView.getUint16(5, true), 1.0);
            const entropyScore = LatticeSnapshotEngine.decodeFixed16(recView.getUint16(7, true), 2.0);
            pos += 9;
            if (pos + dataLen > payload.byteLength)
                break;
            const data = payload.slice(pos, pos + dataLen);
            pos += dataLen;
            if (cellIndex >= GridMemory.TOTAL_CELLS)
                continue;
            const coord = GridMemory.indexToCoord(cellIndex);
            memory.write(coord, data, {
                bitDensity,
                entropyScore,
                quantizationBits: quantBits > 0 ? quantBits : undefined,
            });
        }
        const metadata = {
            magic: 'ONE1',
            totalCellsWritten: totalCells,
            timestamp,
            checksum: storedChecksum,
            byteSize: buffer.byteLength,
        };
        return { memory, metadata, valid };
    }
    // -------------------------------------------------------------------------
    // Diff two snapshots: returns added/removed/modified cell indices
    // -------------------------------------------------------------------------
    diff(baseBuffer, newBuffer) {
        const baseState = this.deserialize(baseBuffer);
        const newState = this.deserialize(newBuffer);
        const added = [];
        const removed = [];
        const modified = [];
        let unchangedCount = 0;
        for (let idx = 0; idx < GridMemory.TOTAL_CELLS; idx++) {
            const coord = GridMemory.indexToCoord(idx);
            const baseCell = baseState.memory.getCell(coord);
            const newCell = newState.memory.getCell(coord);
            const wasOccupied = baseCell.occupied;
            const isOccupied = newCell.occupied;
            if (!wasOccupied && isOccupied) {
                added.push(idx);
            }
            else if (wasOccupied && !isOccupied) {
                removed.push(idx);
            }
            else if (wasOccupied && isOccupied) {
                // Compare data
                const baseLen = baseCell.data?.byteLength ?? 0;
                const newLen = newCell.data?.byteLength ?? 0;
                let changed = baseLen !== newLen;
                if (!changed && baseCell.data && newCell.data) {
                    for (let b = 0; b < baseLen; b++) {
                        if (baseCell.data[b] !== newCell.data[b]) {
                            changed = true;
                            break;
                        }
                    }
                }
                if (changed) {
                    modified.push(idx);
                }
                else {
                    unchangedCount++;
                }
            }
        }
        return { added, removed, modified, unchangedCount };
    }
}
