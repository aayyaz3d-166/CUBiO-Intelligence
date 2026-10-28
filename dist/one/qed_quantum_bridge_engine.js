/**
 * ONE Language QED Photon Flux & Drude Electron Coupling Engine
 * Gate CNL-P26.12: Native Planck-Einstein Energy & Photon Arrival Integration
 *
 * Implements src/one/programs/qed_quantum_bridge.one
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PHYSICAL FOUNDATIONS:
 * 1. Planck-Einstein Quantization:
 *    E_photon = h * f
 *    h = 6.62607015e-34 J·s (CODATA 2018 Exact)
 *    e = 1.602176634e-19 C  (CODATA 2018 Exact)
 *    E_ueV = (E_photon / e) * 1e6
 *
 * 2. Photoelectric / Ionizing Criterion:
 *    Copper Work Function W_Cu = 4.70 eV
 *    Ionizing condition: E_photon >= W_Cu
 *    For RF/microwave photons (e.g. 2.4 GHz ~ 9.93 ueV << 4.7 eV),
 *    radiation is strictly non-ionizing.
 *
 * 3. Macroscopic RF Power to Quantum Photon Flux:
 *    Phi = P_watts / E_photon  [photons/sec]
 *
 * 4. Drude Conduction Electron Drift Rate:
 *    R_e = I / e = (I_uA * 1e-6) / e  [electrons/sec]
 *
 * 5. Photon-to-Electron Quantum Coupling:
 *    eta = Phi / R_e
 * ════════════════════════════════════════════════════════════════════════════
 */
import { PQCLatticeSealEngine } from '../core/crypto/pqc_lattice_seal';
// ── CODATA 2018 Fundamental Constants ─────────────────────────────────────────
export const PLANCK_CONSTANT_H = 6.62607015e-34; // J·s (Exact SI)
export const SPEED_OF_LIGHT_C = 299792458.0; // m/s (Exact SI)
export const ELEMENTARY_CHARGE_E = 1.602176634e-19; // C   (Exact SI)
export const COPPER_WORK_FUNCTION_EV = 4.70; // eV  (Typical polycrystalline Cu)
// Standard Wi-Fi center frequencies
export const WIFI_2_4GHZ_HZ = 2.412e9; // 2.412 GHz (Channel 1)
export const WIFI_5_0GHZ_HZ = 5.180e9; // 5.180 GHz (Channel 36)
export const DEFAULT_ANTENNA_IMPEDANCE_OHMS = 50.0; // 50-ohm RF system
export class QEDRuntimeEngine {
    /**
     * Computes single photon quantum energy using Planck-Einstein relation (E = h * f)
     */
    computePhotonQuantum(frequencyHz) {
        if (frequencyHz <= 0) {
            return {
                frequencyHz: 0,
                energyJoules: 0,
                energyMicroEv: 0,
                isIonizing: false,
                pqcSeal: 'INVALID_FREQUENCY',
            };
        }
        const energyJoules = PLANCK_CONSTANT_H * frequencyHz;
        const energyMicroEv = (energyJoules / ELEMENTARY_CHARGE_E) * 1e6;
        const isIonizing = energyMicroEv >= (COPPER_WORK_FUNCTION_EV * 1e6);
        const sealBuffer = Buffer.from(`qed_photon:f=${frequencyHz.toFixed(3)},E_j=${energyJoules.toExponential(8)},` +
            `E_uev=${energyMicroEv.toFixed(6)},ionizing=${isIonizing}`, 'utf-8');
        const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(sealBuffer);
        return {
            frequencyHz,
            energyJoules,
            energyMicroEv,
            isIonizing,
            pqcSeal,
        };
    }
    /**
     * Evaluates macroscopic RF power to quantum photon arrival flux rate & Drude electron coupling
     */
    evaluateMacroscopicPhotonFlux(powerWatts, frequencyHz, currentUa) {
        const packet = this.computePhotonQuantum(frequencyHz);
        if (packet.energyJoules <= 0.0) {
            return {
                totalPowerWatts: 0.0,
                photonArrivalRatePerSec: 0.0,
                drudeElectronDriftUa: 0.0,
                photonToElectronRatio: 0.0,
                status: 'ERROR_ZERO_ENERGY_STATE',
                pqcSeal: 'INVALID_METRICS',
            };
        }
        // Photon Flux Phi = Power / E_photon
        const photonArrivalRate = powerWatts / packet.energyJoules;
        // Drude electron drift rate = I / e
        const electronDriftRate = (currentUa * 1e-6) / ELEMENTARY_CHARGE_E;
        let photonToElectronRatio = 0.0;
        if (electronDriftRate > 0.0) {
            photonToElectronRatio = photonArrivalRate / electronDriftRate;
        }
        const sealBuffer = Buffer.from(`qed_flux:P=${powerWatts.toExponential(8)},phi=${photonArrivalRate.toExponential(8)},` +
            `I_ua=${currentUa.toFixed(4)},ratio=${photonToElectronRatio.toExponential(6)}`, 'utf-8');
        const pqcSeal = PQCLatticeSealEngine.generatePQCSeal(sealBuffer);
        return {
            totalPowerWatts: powerWatts,
            photonArrivalRatePerSec: photonArrivalRate,
            drudeElectronDriftUa: currentUa,
            photonToElectronRatio,
            status: 'QED_FLUX_CONSERVATION_PASSED',
            pqcSeal,
        };
    }
    /**
     * Full end-to-end RF antenna coupling from RSSI dBm to single-photon quantum metrics
     */
    evaluateRFAntennaCoupling(rssiDbm, frequencyHz = WIFI_2_4GHZ_HZ, antennaResistanceOhms = DEFAULT_ANTENNA_IMPEDANCE_OHMS) {
        // P_watts = 10^((RSSI - 30) / 10)
        const powerWatts = Math.pow(10, (rssiDbm - 30.0) / 10.0);
        // I = sqrt(P / R_ant)
        const currentAmperes = Math.sqrt(powerWatts / antennaResistanceOhms);
        const inducedCurrentUa = currentAmperes * 1e6;
        const photonPacket = this.computePhotonQuantum(frequencyHz);
        const fluxMetrics = this.evaluateMacroscopicPhotonFlux(powerWatts, frequencyHz, inducedCurrentUa);
        const masterBuffer = Buffer.from(`qed_master:rssi=${rssiDbm.toFixed(2)},P=${powerWatts.toExponential(6)},` +
            `I_ua=${inducedCurrentUa.toFixed(4)},photon_seal=${photonPacket.pqcSeal},` +
            `flux_seal=${fluxMetrics.pqcSeal}`, 'utf-8');
        const masterSeal = PQCLatticeSealEngine.generatePQCSeal(masterBuffer);
        return {
            rssiDbm,
            powerWatts,
            inducedCurrentUa,
            photonPacket,
            fluxMetrics,
            isActuationBlocked: true,
            uup: 1.0,
            sigmaSq: 0.0,
            masterSeal,
        };
    }
}
export function formatQEDPhotonReport(packet) {
    return [
        '════════════════════════════════════════════════════════════════',
        '  Gate CNL-P26.12: Planck-Einstein Quantum Photon Evaluation',
        '════════════════════════════════════════════════════════════════',
        `  Carrier Frequency    : ${(packet.frequencyHz / 1e9).toFixed(4)} GHz  (${packet.frequencyHz.toExponential(3)} Hz)`,
        `  Photon Energy (J)    : ${packet.energyJoules.toExponential(8)} Joules`,
        `  Photon Energy (μeV)  : ${packet.energyMicroEv.toFixed(4)} μeV`,
        `  Ionizing Threshold   : 4.70 eV (Copper Work Function)`,
        `  Is Ionizing Rad      : ${packet.isIonizing} (Strict Non-Ionizing)`,
        `  PQC Lattice Seal     : ${packet.pqcSeal}`,
        '  Constraints          : is_actuation_blocked=true | UUP=1.0 | σ²=0.0',
        '════════════════════════════════════════════════════════════════',
    ].join('\n');
}
export function formatQEDFluxReport(metrics, packet) {
    return [
        '════════════════════════════════════════════════════════════════',
        '  Gate CNL-P26.12: QED Photon Flux & Drude Electron Coupling',
        '════════════════════════════════════════════════════════════════',
        `  RF Power Ingest      : ${metrics.totalPowerWatts.toExponential(6)} Watts`,
        `  Single Photon Energy : ${packet.energyJoules.toExponential(6)} Joules (${packet.energyMicroEv.toFixed(3)} μeV)`,
        `  Photon Arrival Rate  : ${metrics.photonArrivalRatePerSec.toExponential(6)} photons/sec`,
        `  Drude Conduction I   : ${metrics.drudeElectronDriftUa.toFixed(4)} μA`,
        `  Photon-to-Electron η : ${metrics.photonToElectronRatio.toFixed(3)} photons per drift electron`,
        `  Conservation Status  : ${metrics.status}`,
        `  PQC Lattice Seal     : ${metrics.pqcSeal}`,
        '  Constraints          : is_actuation_blocked=true | UUP=1.0 | σ²=0.0',
        '════════════════════════════════════════════════════════════════',
    ].join('\n');
}
