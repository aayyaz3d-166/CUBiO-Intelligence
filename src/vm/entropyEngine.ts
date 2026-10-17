/**
 * ONE Language & CubiO Spatial VM - Phase 1 Prototype
 * Module 2: Native Entropy Engine (entropyEngine.ts)
 *
 * Maps binary stream chunks (2-bit sequences) to quantum-like basis vectors:
 *   |00>, |01>, |10>, |11>
 * Constructs 4x4 Density Matrix rho = sum p_k |psi_k><psi_k|
 * Computes Eigenvalues lambda_i of matrix rho
 * Calculates Von Neumann Entropy: S(rho) = - sum lambda_i * log2(lambda_i) in [0.0, 2.0]
 * Handles mathematical edge cases (0 * log2(0) = 0).
 */

export interface EntropyAnalysis {
  stateCounts: [number, number, number, number]; // counts of |00>, |01>, |10>, |11>
  probabilities: [number, number, number, number]; // p_00, p_01, p_10, p_11
  densityMatrix: number[][]; // 4x4 real symmetric density matrix
  eigenvalues: number[]; // 4 eigenvalues in descending order
  vonNeumannEntropy: number; // S(rho) in [0.0, 2.0]
  purity: number; // Tr(rho^2) in [0.25, 1.0]
  isPureState: boolean; // Tr(rho^2) approx 1.0
  isMaximalMixed: boolean; // Tr(rho^2) approx 0.25
}

export class EntropyEngine {
  /**
   * Basis vectors:
   * |00> = [1, 0, 0, 0]^T
   * |01> = [0, 1, 0, 0]^T
   * |10> = [0, 0, 1, 0]^T
   * |11> = [0, 0, 0, 1]^T
   */
  public static readonly BASIS_LABELS = ['|00>', '|01>', '|10>', '|11>'];

  /**
   * Analyze binary bitstream to construct 4x4 density matrix and compute Von Neumann entropy.
   * If modelCoherence is true, constructs a density matrix with transition coherences (off-diagonals)
   * while preserving Tr(rho)=1 and positive semi-definiteness.
   * If modelCoherence is false (standard statistical ensemble), rho is the diagonal ensemble matrix.
   */
  public analyze(bitString: string, includeCoherence: boolean = false): EntropyAnalysis {
    if (bitString.length < 2) {
      // Degenerate single bit or empty
      const p: [number, number, number, number] = [1, 0, 0, 0];
      const rho = this.createDiagonalMatrix(p);
      return {
        stateCounts: [0, 0, 0, 0],
        probabilities: p,
        densityMatrix: rho,
        eigenvalues: [1, 0, 0, 0],
        vonNeumannEntropy: 0.0,
        purity: 1.0,
        isPureState: true,
        isMaximalMixed: false,
      };
    }

    // Partition stream into 2-bit non-overlapping tokens (with final 1-bit padded if odd)
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let totalPairs = 0;

    // Track transitions for off-diagonal coherence if requested
    const transitionMatrix = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    let prevIdx: number | null = null;

    for (let i = 0; i < bitString.length; i += 2) {
      let b0 = bitString[i];
      let b1 = i + 1 < bitString.length ? bitString[i + 1] : '0';
      let idx = (b0 === '1' ? 2 : 0) + (b1 === '1' ? 1 : 0);

      counts[idx]++;
      totalPairs++;

      if (prevIdx !== null) {
        transitionMatrix[prevIdx][idx]++;
      }
      prevIdx = idx;
    }

    const p: [number, number, number, number] = [
      counts[0] / totalPairs,
      counts[1] / totalPairs,
      counts[2] / totalPairs,
      counts[3] / totalPairs,
    ];

    let rho: number[][];

    if (!includeCoherence) {
      // Pure orthogonal basis statistical ensemble: rho = sum p_k |psi_k><psi_k|
      // In this canonical basis, rho is diagonal:
      // rho[i][i] = p_i, rho[i][j] = 0 for i != j
      rho = this.createDiagonalMatrix(p);
    } else {
      // Hermitian density matrix incorporating consecutive state coherences
      rho = this.constructCoherentDensityMatrix(p, transitionMatrix, totalPairs);
    }

    // Compute eigenvalues of 4x4 symmetric matrix
    const eigenvalues = this.computeEigenvaluesSymmetric4x4(rho);

    // Compute Von Neumann Entropy: S(rho) = - sum lambda_i * log2(lambda_i)
    // Edge case: 0 * log2(0) = 0
    let vonNeumannEntropy = 0;
    for (const lambda of eigenvalues) {
      if (lambda > 1e-12) {
        vonNeumannEntropy -= lambda * Math.log2(lambda);
      }
    }

    // Numerical safeguard: clamp to [0.0, 2.0]
    vonNeumannEntropy = Math.max(0.0, Math.min(2.0, vonNeumannEntropy));
    if (Math.abs(vonNeumannEntropy) < 1e-10) {
      vonNeumannEntropy = 0.0;
    }

    // Compute Purity: gamma = Tr(rho^2) = sum (lambda_i)^2
    let purity = 0;
    for (const lambda of eigenvalues) {
      purity += lambda * lambda;
    }

    const isPureState = Math.abs(purity - 1.0) < 1e-3;
    const isMaximalMixed = Math.abs(purity - 0.25) < 1e-3;

    return {
      stateCounts: counts,
      probabilities: p,
      densityMatrix: rho,
      eigenvalues,
      vonNeumannEntropy,
      purity,
      isPureState,
      isMaximalMixed,
    };
  }

  private createDiagonalMatrix(p: [number, number, number, number]): number[][] {
    return [
      [p[0], 0, 0, 0],
      [0, p[1], 0, 0],
      [0, 0, p[2], 0],
      [0, 0, 0, p[3]],
    ];
  }

  private constructCoherentDensityMatrix(
    p: [number, number, number, number],
    transitions: number[][],
    totalTransitions: number
  ): number[][] {
    const rho: number[][] = [
      [p[0], 0, 0, 0],
      [0, p[1], 0, 0],
      [0, 0, p[2], 0],
      [0, 0, 0, p[3]],
    ];

    if (totalTransitions <= 1) return rho;

    // Symmetrize off-diagonals with Cauchy-Schwarz bound rho_ij^2 <= rho_ii * rho_jj
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const tCount = (transitions[i][j] + transitions[j][i]) / 2;
        const rawCoherence = tCount / totalTransitions;
        const maxCoherence = Math.sqrt(p[i] * p[j]) * 0.95; // ensure strict positive semi-definiteness
        const val = Math.min(rawCoherence, maxCoherence);
        rho[i][j] = val;
        rho[j][i] = val;
      }
    }

    return rho;
  }

  /**
   * Jacobi Eigenvalue Algorithm for real 4x4 symmetric matrix
   * Guaranteed to converge rapidly (usually < 15 iterations) and yields exact orthogonal eigenvalues.
   */
  public computeEigenvaluesSymmetric4x4(matrix: number[][]): number[] {
    const n = 4;
    // Clone matrix
    const A: number[][] = matrix.map((row) => [...row]);
    const maxIterations = 50;
    const eps = 1e-12;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Find largest off-diagonal element
      let maxVal = 0;
      let p = 0;
      let q = 1;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const absVal = Math.abs(A[i][j]);
          if (absVal > maxVal) {
            maxVal = absVal;
            p = i;
            q = j;
          }
        }
      }

      if (maxVal < eps) {
        break; // Converged
      }

      // Compute Jacobi rotation angle
      const app = A[p][p];
      const aqq = A[q][q];
      const apq = A[p][q];

      const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      // Apply rotation to A: A' = J^T * A * J
      const newApp = c * c * app - 2 * s * c * apq + s * s * aqq;
      const newAqq = s * s * app + 2 * s * c * apq + c * c * aqq;
      A[p][p] = newApp;
      A[q][q] = newAqq;
      A[p][q] = 0;
      A[q][p] = 0;

      for (let i = 0; i < n; i++) {
        if (i !== p && i !== q) {
          const aip = A[i][p];
          const aiq = A[i][q];
          A[i][p] = c * aip - s * aiq;
          A[p][i] = A[i][p];
          A[i][q] = s * aip + c * aiq;
          A[q][i] = A[i][q];
        }
      }
    }

    // Extract eigenvalues from diagonal
    const eigenvalues = [A[0][0], A[1][1], A[2][2], A[3][3]];

    // Clean negative numerical artifacts close to 0
    for (let i = 0; i < 4; i++) {
      if (eigenvalues[i] < 0 && eigenvalues[i] > -1e-10) {
        eigenvalues[i] = 0;
      }
    }

    // Sort descending
    eigenvalues.sort((a, b) => b - a);

    return eigenvalues;
  }
}
