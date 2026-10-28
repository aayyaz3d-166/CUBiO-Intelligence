/**
 * Canonical Address369 Memory Map
 * Module: ONE Language Core ("one-memory-canonical")
 * Specification: Gate CNL-P26.1-R1 Forensic Correction
 *
 * Canonical Indexing Architecture:
 *   - Internal Addresses: [0..368] (Strictly 369 cells)
 *   - Symbolic Layer:     [0..25]  (26 symbolic registers)
 *   - Spatial Layer:      [26..368] (343 spatial voxel cells, 7x7x7)
 *   - UI Display Index:   [1..369] (Explicitly designated as Display Index)
 */
export class CanonicalAddress369 {
    static TOTAL_ADDRESSES = 369;
    static SYMBOLIC_COUNT = 26;
    static SPATIAL_COUNT = 343; // 7 * 7 * 7
    static SYMBOLIC_START = 0;
    static SYMBOLIC_END = 25;
    static SPATIAL_START = 26;
    static SPATIAL_END = 368;
    /**
     * Converts an internal 0-indexed address [0..368] to an explicit UI Display Index [1..369].
     */
    static toDisplayIndex(internalAddress) {
        if (internalAddress < 0 || internalAddress >= this.TOTAL_ADDRESSES) {
            throw new Error(`[Address369 Bounds Error] Internal address ${internalAddress} is outside valid canonical range [0..368].`);
        }
        return internalAddress + 1;
    }
    /**
     * Converts a UI Display Index [1..369] back to an internal 0-indexed address [0..368].
     */
    static fromDisplayIndex(displayIndex) {
        if (displayIndex < 1 || displayIndex > this.TOTAL_ADDRESSES) {
            throw new Error(`[Address369 Bounds Error] Display Index ${displayIndex} is outside valid UI range [1..369].`);
        }
        return displayIndex - 1;
    }
    /**
     * Returns human-readable explicit Display Index tag.
     */
    static formatDisplayIndex(internalAddress) {
        const disp = this.toDisplayIndex(internalAddress);
        return `Display Index [${disp}..369] (Internal: ${internalAddress})`;
    }
    /**
     * Maps 3D spatial voxel coordinates (i, j, k) in [0..6] to canonical spatial address [26..368].
     */
    static spatialCoordToCanonicalAddress(i, j, k) {
        if (i < 0 || i > 6 || j < 0 || j > 6 || k < 0 || k > 6) {
            throw new Error(`[Address369 Error] Coordinate (${i}, ${j}, ${k}) is outside 7x7x7 grid [0..6].`);
        }
        const spatialOffset = i + 7 * j + 49 * k; // 0..342
        return this.SPATIAL_START + spatialOffset; // 26..368
    }
    /**
     * Maps a canonical spatial address [26..368] back to 3D spatial voxel coordinates (i, j, k) in [0..6].
     */
    static canonicalAddressToSpatialCoord(address) {
        if (address < this.SPATIAL_START || address > this.SPATIAL_END) {
            throw new Error(`[Address369 Error] Address ${address} is not in the canonical spatial range [26..368].`);
        }
        const offset = address - this.SPATIAL_START; // 0..342
        const k = Math.floor(offset / 49);
        const rem = offset % 49;
        const j = Math.floor(rem / 7);
        const i = rem % 7;
        return { i, j, k };
    }
    /**
     * Inspects and returns complete metadata for any canonical address [0..368].
     */
    static inspectAddress(internalAddress) {
        const displayIndex = this.toDisplayIndex(internalAddress);
        if (internalAddress <= this.SYMBOLIC_END) {
            const symLetter = String.fromCharCode(65 + internalAddress); // A..Z
            return {
                internalAddress,
                displayIndex,
                layer: 'SYMBOLIC',
                symbolicKey: `SYM_${symLetter}_${internalAddress.toString().padStart(2, '0')}`,
                description: `Symbolic Register [${symLetter}] at ${this.formatDisplayIndex(internalAddress)}`,
            };
        }
        const coord = this.canonicalAddressToSpatialCoord(internalAddress);
        return {
            internalAddress,
            displayIndex,
            layer: 'SPATIAL',
            spatialCoord: coord,
            description: `Spatial Voxel Cell (${coord.i}, ${coord.j}, ${coord.k}) at ${this.formatDisplayIndex(internalAddress)}`,
        };
    }
}
