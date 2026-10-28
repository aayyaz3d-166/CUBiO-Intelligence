/**
 * ONE Language Spatial Material Grid & Permittivity Engine
 * Gate CNL-P26.11: Solid Interference & Wave Velocity Slowdown Modeling
 *
 * Implements src/one/programs/spatial_material_grid.one for the 343-cell lattice (7×7×7).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PHYSICAL FOUNDATIONS:
 * 1. Maxwell Dielectric Wave Velocity Slowdown:
 *    v = c / sqrt(epsilon_r * mu_r)
 *    For non-magnetic media (mu_r ~ 1.0):
 *    propagation_velocity_factor = 1.0 / sqrt(epsilon_r)
 *
 * 2. Energy Density Pressure:
 *    local_pressure = P_in * rho * epsilon_r * 0.001
 *
 * 3. 343-Cell Spatial Lattice:
 *    Dimensions: 7 x 7 x 7
 *    Index: x + 7*y + 49*z  (x, y, z in [0, 6])
 *    Center / Origin Cell: (3, 3, 3) -> Index = 3 + 21 + 147 = 171
 * ════════════════════════════════════════════════════════════════════════════
 */
import { PQCLatticeSealEngine } from '../core/crypto/pqc_lattice_seal';
export var MaterialType;
(function (MaterialType) {
    MaterialType[MaterialType["AIR"] = 0] = "AIR";
    MaterialType[MaterialType["CONCRETE"] = 1] = "CONCRETE";
    MaterialType[MaterialType["METAL"] = 2] = "METAL";
    MaterialType[MaterialType["HUMAN_MASS"] = 3] = "HUMAN_MASS";
})(MaterialType || (MaterialType = {}));
export const LATTICE_DIMENSION = 7;
export const LATTICE_SIZE = 343; // 7 * 7 * 7
export const CENTER_CELL_ID = 171; // (3, 3, 3)
export class CUBiOMaterialLayer {
    lattice;
    constructor() {
        this.lattice = new Array(LATTICE_SIZE);
        for (let i = 0; i < LATTICE_SIZE; i++) {
            this.lattice[i] = this.getDefaultAirProperties();
        }
    }
    getDefaultAirProperties() {
        return {
            material: MaterialType.AIR,
            permittivityEpsilonR: 1.0,
            densityKgM3: 1.204,
            isObstacle: false,
        };
    }
    /**
     * Convert 3D coordinates (x, y, z) into 1D lattice index
     */
    static coordinateToIndex(x, y, z) {
        if (x < 0 || x >= LATTICE_DIMENSION || y < 0 || y >= LATTICE_DIMENSION || z < 0 || z >= LATTICE_DIMENSION) {
            return -1;
        }
        return x + y * LATTICE_DIMENSION + z * (LATTICE_DIMENSION * LATTICE_DIMENSION);
    }
    /**
     * Convert 1D lattice index into 3D coordinates (x, y, z)
     */
    static indexToCoordinate(cellId) {
        if (cellId < 0 || cellId >= LATTICE_SIZE) {
            return { x: -1, y: -1, z: -1 };
        }
        const z = Math.floor(cellId / (LATTICE_DIMENSION * LATTICE_DIMENSION));
        const rem = cellId % (LATTICE_DIMENSION * LATTICE_DIMENSION);
        const y = Math.floor(rem / LATTICE_DIMENSION);
        const x = rem % LATTICE_DIMENSION;
        return { x, y, z };
    }
    /**
     * Assign material properties to a cell in the 343 lattice
     */
    assignMaterial(cellId, mat) {
        if (cellId < 0 || cellId >= LATTICE_SIZE) {
            return this.getDefaultAirProperties();
        }
        let props;
        switch (mat) {
            case MaterialType.CONCRETE:
                props = {
                    material: mat,
                    permittivityEpsilonR: 6.5,
                    densityKgM3: 2300.0,
                    isObstacle: true,
                };
                break;
            case MaterialType.METAL:
                props = {
                    material: mat,
                    permittivityEpsilonR: 1.0, // High reflection/conductive barrier model
                    densityKgM3: 7850.0,
                    isObstacle: true,
                };
                break;
            case MaterialType.HUMAN_MASS:
                props = {
                    material: mat,
                    permittivityEpsilonR: 50.0, // High dielectric absorption due to water content
                    densityKgM3: 985.0,
                    isObstacle: true,
                };
                break;
            case MaterialType.AIR:
            default:
                props = this.getDefaultAirProperties();
                break;
        }
        this.lattice[cellId] = props;
        return props;
    }
    /**
     * Get properties of a specific cell
     */
    getCell(cellId) {
        if (cellId < 0 || cellId >= LATTICE_SIZE) {
            return this.getDefaultAirProperties();
        }
        return this.lattice[cellId];
    }
    /**
     * Evaluate electromagnetic wave interference and velocity slowdown on a cell
     */
    evaluateWaveInterference(cellId, cell, incomingSignalPower) {
        // Wave velocity reduction factor: v_factor = 1 / sqrt(epsilon_r)
        const velocityFactor = 1.0 / Math.sqrt(cell.permittivityEpsilonR);
        // Energy density pressure: incoming_power * density * epsilon_r * 0.001
        const localPressure = incomingSignalPower * cell.densityKgM3 * cell.permittivityEpsilonR * 0.001;
        const status = cell.isObstacle ? 'SOLID_INTERFERENCE_DETECTED' : 'UNOBSTRUCTED_FREE_SPACE';
        const sealBuffer = Buffer.from(`cell:${cellId},mat:${cell.material},eps:${cell.permittivityEpsilonR.toFixed(3)},` +
            `v_factor:${velocityFactor.toFixed(6)},press:${localPressure.toFixed(6)},status:${status}`, 'utf-8');
        const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(sealBuffer);
        return {
            cellId,
            propagationVelocityFactor: velocityFactor,
            energyDensityPressure: localPressure,
            status,
            pqcSeal,
        };
    }
    /**
     * Evaluate wave interaction directly by cell ID
     */
    evaluateCell(cellId, incomingSignalPower) {
        const props = this.getCell(cellId);
        return this.evaluateWaveInterference(cellId, props, incomingSignalPower);
    }
    /**
     * Scan entire 343-cell lattice for aggregate interference metrics
     */
    scanLatticeInterference(incomingSignalPower) {
        let obstacleCount = 0;
        let totalVelocity = 0;
        let totalPressure = 0;
        for (let i = 0; i < LATTICE_SIZE; i++) {
            const cell = this.lattice[i];
            if (cell.isObstacle) {
                obstacleCount++;
            }
            const vFactor = 1.0 / Math.sqrt(cell.permittivityEpsilonR);
            const pressure = incomingSignalPower * cell.densityKgM3 * cell.permittivityEpsilonR * 0.001;
            totalVelocity += vFactor;
            totalPressure += pressure;
        }
        const centerResult = this.evaluateCell(CENTER_CELL_ID, incomingSignalPower);
        const scanBuffer = Buffer.from(`lattice:343,obstacles:${obstacleCount},mean_v:${(totalVelocity / LATTICE_SIZE).toFixed(6)},` +
            `total_p:${totalPressure.toFixed(6)},center_seal:${centerResult.pqcSeal}`, 'utf-8');
        const latticeSeal = PQCLatticeSealEngine.generatePQCSeal(scanBuffer);
        return {
            totalCells: LATTICE_SIZE,
            obstacleCount,
            freeSpaceCount: LATTICE_SIZE - obstacleCount,
            meanVelocityFactor: totalVelocity / LATTICE_SIZE,
            totalEnergyPressure: totalPressure,
            centerCellResult: centerResult,
            latticeSeal,
            isActuationBlocked: true,
            uup: 1.0,
            sigmaSq: 0.0,
        };
    }
}
export function formatMaterialReport(res, cell) {
    const coord = CUBiOMaterialLayer.indexToCoordinate(res.cellId);
    const matName = MaterialType[cell.material];
    return [
        '════════════════════════════════════════════════════════════════',
        '  Gate CNL-P26.11: Spatial Material Interference Evaluation',
        '════════════════════════════════════════════════════════════════',
        `  Target Cell ID       : ${res.cellId}  (x=${coord.x}, y=${coord.y}, z=${coord.z})`,
        `  Material Assigned    : ${matName}`,
        `  Permittivity (ε_r)   : ${cell.permittivityEpsilonR.toFixed(2)}`,
        `  Density (ρ)          : ${cell.densityKgM3.toFixed(1)} kg/m³`,
        `  Is Obstacle          : ${cell.isObstacle}`,
        `  Velocity Factor      : ${res.propagationVelocityFactor.toFixed(6)}  (1/sqrt(ε_r))`,
        `  Energy Pressure      : ${res.energyDensityPressure.toFixed(4)}`,
        `  Interaction Status   : ${res.status}`,
        `  PQC Lattice Seal     : ${res.pqcSeal}`,
        '  Constraints          : is_actuation_blocked=true | UUP=1.0 | σ²=0.0',
        '════════════════════════════════════════════════════════════════',
    ].join('\n');
}
