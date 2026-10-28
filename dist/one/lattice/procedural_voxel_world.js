/**
 * CUBiO Sovereign Procedural 3D Voxel World Generator
 * Gate: CNL-P22-001 | Sovereign Game World ("one-world")
 * Generates deterministic 3D voxel terrain in 7x7x7 (343 cells) spatial chunks
 */
export class ProceduralVoxelWorldEngine {
    seed;
    constructor(seed = 369) {
        this.seed = seed;
    }
    /**
     * Deterministic pseudo-random generator with σ² = 0.0 variance across replays.
     */
    deterministicNoise(x, y, z) {
        const val = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + this.seed) * 43758.5453;
        return val - Math.floor(val);
    }
    /**
     * Generates a 7x7x7 (343-cell) spatial voxel chunk.
     */
    generateChunk(cx = 0, cy = 0, cz = 0) {
        const cells = [];
        let energyCount = 0;
        for (let x = -3; x <= 3; x++) {
            for (let y = -3; y <= 3; y++) {
                for (let z = -3; z <= 3; z++) {
                    const worldX = cx * 7 + x;
                    const worldY = cy * 7 + y;
                    const worldZ = cz * 7 + z;
                    const noise = this.deterministicNoise(worldX, worldY, worldZ);
                    let type = 'AIR';
                    let colorHex = '#000000';
                    let freq = 3;
                    // Terrain elevation logic
                    if (y === -3) {
                        type = 'TERRAIN_BEDROCK';
                        colorHex = '#1e293b';
                        freq = 3;
                    }
                    else if (x === 0 && z === 0 && y > -3) {
                        // Central Crystal Spire
                        type = 'CRYSTAL_SPIRE';
                        colorHex = '#06b6d4'; // 6 MHz Cyan
                        freq = 6;
                        energyCount++;
                    }
                    else if (y === 0 && (Math.abs(x) === 2 || Math.abs(z) === 2)) {
                        // Energy Ley-lines
                        type = 'ENERGY_LEYLINE';
                        colorHex = '#f59e0b'; // 9 MHz Amber
                        freq = 9;
                        energyCount++;
                    }
                    else if (x === 0 && y === 0 && z === 0) {
                        // Center Quantum Portal
                        type = 'QUANTUM_PORTAL';
                        colorHex = '#10b981'; // 3 MHz Emerald
                        freq = 3;
                        energyCount++;
                    }
                    else if (noise > 0.85 && y < 2) {
                        type = 'TERRAIN_BEDROCK';
                        colorHex = '#334155';
                        freq = 3;
                    }
                    cells.push({
                        x: worldX,
                        y: worldY,
                        z: worldZ,
                        type,
                        density: type === 'AIR' ? 0.0 : 1.0,
                        harmonicResonanceMhz: freq,
                        colorHex,
                    });
                }
            }
        }
        // Compute deterministic chunk checksum
        let hash = 0x811c9dc5;
        const str = JSON.stringify(cells.map((c) => c.type));
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        const checksum = '0x369_' + (hash >>> 0).toString(16).padStart(8, '0');
        return {
            chunkId: `CHUNK_${cx}_${cy}_${cz}`,
            chunkCoord: [cx, cy, cz],
            cells,
            activeEnergyNodesCount: energyCount,
            checksum,
        };
    }
}
