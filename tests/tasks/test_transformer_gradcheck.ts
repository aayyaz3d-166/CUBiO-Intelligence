/**
 * CUBiO AI — FULL TRANSFORMER FINITE-DIFFERENCE GRADIENT CHECK
 * ==============================================================
 * Config: 2 layers, d_model = 32, 2 heads (head_dim = 16), d_ff = 64, T = 8 tokens, vocab = 32.
 * Real causal multi-head attention, real LayerNorm, real MLP, Cross-Entropy Loss.
 *
 * Verifies analytical autograd gradients against numerical finite-difference perturbations
 * across EVERY parameter group in the model.
 */

import { Tensor } from '../../src/one/tensor/Tensor';
import { GradCheck } from '../../src/one/tensor/GradCheck';

export interface MiniTransformerConfig {
  vocabSize: number;
  dModel: number;
  numHeads: number;
  headDim: number;
  dFF: number;
  numLayers: number;
  seqLen: number;
}

export interface LayerWeights {
  ln1Gamma: Tensor;
  ln1Beta: Tensor;
  wq: Tensor;
  wk: Tensor;
  wv: Tensor;
  wo: Tensor;
  ln2Gamma: Tensor;
  ln2Beta: Tensor;
  w1: Tensor;
  b1: Tensor;
  w2: Tensor;
  b2: Tensor;
}

export interface TransformerWeights {
  embedding: Tensor;
  layers: LayerWeights[];
  finalLnGamma: Tensor;
  finalLnBeta: Tensor;
  head: Tensor;
}

export function createMiniTransformer(config: MiniTransformerConfig, seed: number = 42): TransformerWeights {
  const { vocabSize, dModel, dFF, numLayers } = config;

  let s = seed;
  const randVal = (scale: number = 0.1) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return ((s / 4294967296) * 2.0 - 1.0) * scale;
  };

  const createTensor = (shape: number[], scale: number = 0.1): Tensor => {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) data[i] = randVal(scale);
    return new Tensor(data, shape).withRequiresGrad(true);
  };

  const createOnes = (shape: number[]): Tensor => {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size).fill(1.0);
    return new Tensor(data, shape).withRequiresGrad(true);
  };

  const createZeros = (shape: number[]): Tensor => {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size).fill(0.0);
    return new Tensor(data, shape).withRequiresGrad(true);
  };

  const layers: LayerWeights[] = [];
  for (let l = 0; l < numLayers; l++) {
    layers.push({
      ln1Gamma: createOnes([dModel]),
      ln1Beta: createZeros([dModel]),
      wq: createTensor([dModel, dModel], 1.0 / Math.sqrt(dModel)),
      wk: createTensor([dModel, dModel], 1.0 / Math.sqrt(dModel)),
      wv: createTensor([dModel, dModel], 1.0 / Math.sqrt(dModel)),
      wo: createTensor([dModel, dModel], 1.0 / Math.sqrt(dModel)),
      ln2Gamma: createOnes([dModel]),
      ln2Beta: createZeros([dModel]),
      w1: createTensor([dModel, dFF], 1.0 / Math.sqrt(dModel)),
      b1: createZeros([dFF]),
      w2: createTensor([dFF, dModel], 1.0 / Math.sqrt(dFF)),
      b2: createZeros([dModel]),
    });
  }

  return {
    embedding: createTensor([vocabSize, dModel], 0.1),
    layers,
    finalLnGamma: createOnes([dModel]),
    finalLnBeta: createZeros([dModel]),
    head: createTensor([dModel, vocabSize], 1.0 / Math.sqrt(dModel)),
  };
}

/**
 * Pure-function forward pass computing scalar cross-entropy loss.
 * Supports direct perturbation of any parameter Tensor during finite difference check.
 */
export function forwardLoss(
  weights: TransformerWeights,
  tokens: number[],
  targets: number[],
  config: MiniTransformerConfig
): { loss: number; cache?: any } {
  const { dModel, numHeads, headDim, dFF, numLayers, seqLen, vocabSize } = config;
  const T = seqLen;
  const D = dModel;
  const H = numHeads;
  const Dh = headDim;

  // 1. Embedding lookup [T, D]
  const X = new Float32Array(T * D);
  for (let t = 0; t < T; t++) {
    const tok = tokens[t] % vocabSize;
    const off = tok * D;
    for (let d = 0; d < D; d++) {
      X[t * D + d] = weights.embedding.data[weights.embedding.offset + off + d];
    }
  }

  // Intermediate activations for backpropagation
  const layerCaches: any[] = [];
  let currentH = X;

  // 2. Transformer Layers
  for (let l = 0; l < numLayers; l++) {
    const lw = weights.layers[l];

    // --- Pre-LN 1 ---
    const xIn = new Float32Array(currentH);
    const ln1Out = new Float32Array(T * D);
    const ln1XHat = new Float32Array(T * D);
    const ln1InvStd = new Float32Array(T);

    for (let t = 0; t < T; t++) {
      let sum = 0.0;
      for (let d = 0; d < D; d++) sum += xIn[t * D + d];
      const mean = sum / D;

      let varSum = 0.0;
      for (let d = 0; d < D; d++) {
        const diff = xIn[t * D + d] - mean;
        varSum += diff * diff;
      }
      const invStd = 1.0 / Math.sqrt(varSum / D + 1e-5);
      ln1InvStd[t] = invStd;

      for (let d = 0; d < D; d++) {
        const xHat = (xIn[t * D + d] - mean) * invStd;
        ln1XHat[t * D + d] = xHat;
        ln1Out[t * D + d] = xHat * lw.ln1Gamma.data[lw.ln1Gamma.offset + d] + lw.ln1Beta.data[lw.ln1Beta.offset + d];
      }
    }

    // --- Causal Multi-Head Attention ---
    // Linear projections: Q = ln1Out x Wq, K = ln1Out x Wk, V = ln1Out x Wv
    const Q = new Float32Array(T * D);
    const K = new Float32Array(T * D);
    const V = new Float32Array(T * D);

    const wqData = lw.wq.data;
    const wkData = lw.wk.data;
    const wvData = lw.wv.data;
    const wqOff = lw.wq.offset;
    const wkOff = lw.wk.offset;
    const wvOff = lw.wv.offset;

    for (let t = 0; t < T; t++) {
      for (let j = 0; j < D; j++) {
        let sumQ = 0.0, sumK = 0.0, sumV = 0.0;
        for (let i = 0; i < D; i++) {
          const xVal = ln1Out[t * D + i];
          sumQ += xVal * wqData[wqOff + i * D + j];
          sumK += xVal * wkData[wkOff + i * D + j];
          sumV += xVal * wvData[wvOff + i * D + j];
        }
        Q[t * D + j] = sumQ;
        K[t * D + j] = sumK;
        V[t * D + j] = sumV;
      }
    }

    // Scaled dot-product causal attention per head
    const scale = 1.0 / Math.sqrt(Dh);
    const attnOut = new Float32Array(T * D);
    const attnScores = new Float32Array(H * T * T);
    const attnWeights = new Float32Array(H * T * T);

    for (let h = 0; h < H; h++) {
      const hOff = h * Dh;
      for (let i = 0; i < T; i++) {
        let maxScore = -Infinity;
        for (let j = 0; j < T; j++) {
          if (j > i) {
            attnScores[h * T * T + i * T + j] = -1e9; // Causal mask
            continue;
          }
          let dot = 0.0;
          for (let d = 0; d < Dh; d++) {
            dot += Q[i * D + hOff + d] * K[j * D + hOff + d];
          }
          const score = dot * scale;
          attnScores[h * T * T + i * T + j] = score;
          if (score > maxScore) maxScore = score;
        }

        // Softmax across keys j <= i
        let expSum = 0.0;
        for (let j = 0; j < T; j++) {
          if (j > i) {
            attnWeights[h * T * T + i * T + j] = 0.0;
          } else {
            const exp = Math.exp(attnScores[h * T * T + i * T + j] - maxScore);
            attnWeights[h * T * T + i * T + j] = exp;
            expSum += exp;
          }
        }
        const invExpSum = 1.0 / (expSum + 1e-12);
        for (let j = 0; j <= i; j++) {
          attnWeights[h * T * T + i * T + j] *= invExpSum;
        }

        // Weighted sum over V
        for (let d = 0; d < Dh; d++) {
          let sumVal = 0.0;
          for (let j = 0; j <= i; j++) {
            sumVal += attnWeights[h * T * T + i * T + j] * V[j * D + hOff + d];
          }
          attnOut[i * D + hOff + d] = sumVal;
        }
      }
    }

    // Output projection: projOut = attnOut x Wo
    const projOut = new Float32Array(T * D);
    const woData = lw.wo.data;
    const woOff = lw.wo.offset;
    for (let t = 0; t < T; t++) {
      for (let j = 0; j < D; j++) {
        let sum = 0.0;
        for (let i = 0; i < D; i++) {
          sum += attnOut[t * D + i] * woData[woOff + i * D + j];
        }
        projOut[t * D + j] = sum;
      }
    }

    // Residual 1: midH = xIn + projOut
    const midH = new Float32Array(T * D);
    for (let i = 0; i < T * D; i++) midH[i] = xIn[i] + projOut[i];

    // --- Pre-LN 2 ---
    const ln2Out = new Float32Array(T * D);
    const ln2XHat = new Float32Array(T * D);
    const ln2InvStd = new Float32Array(T);

    for (let t = 0; t < T; t++) {
      let sum = 0.0;
      for (let d = 0; d < D; d++) sum += midH[t * D + d];
      const mean = sum / D;

      let varSum = 0.0;
      for (let d = 0; d < D; d++) {
        const diff = midH[t * D + d] - mean;
        varSum += diff * diff;
      }
      const invStd = 1.0 / Math.sqrt(varSum / D + 1e-5);
      ln2InvStd[t] = invStd;

      for (let d = 0; d < D; d++) {
        const xHat = (midH[t * D + d] - mean) * invStd;
        ln2XHat[t * D + d] = xHat;
        ln2Out[t * D + d] = xHat * lw.ln2Gamma.data[lw.ln2Gamma.offset + d] + lw.ln2Beta.data[lw.ln2Beta.offset + d];
      }
    }

    // --- MLP: W1 (D -> dFF) + ReLU + W2 (dFF -> D) ---
    const hMLP = new Float32Array(T * dFF);
    const hMLPAct = new Float32Array(T * dFF);
    const w1Data = lw.w1.data;
    const w1Off = lw.w1.offset;
    const b1Data = lw.b1.data;
    const b1Off = lw.b1.offset;

    for (let t = 0; t < T; t++) {
      for (let j = 0; j < dFF; j++) {
        let sum = b1Data[b1Off + j];
        for (let i = 0; i < D; i++) {
          sum += ln2Out[t * D + i] * w1Data[w1Off + i * dFF + j];
        }
        hMLP[t * dFF + j] = sum;
        hMLPAct[t * dFF + j] = Math.max(0.0, sum); // ReLU
      }
    }

    const mlpOut = new Float32Array(T * D);
    const w2Data = lw.w2.data;
    const w2Off = lw.w2.offset;
    const b2Data = lw.b2.data;
    const b2Off = lw.b2.offset;

    for (let t = 0; t < T; t++) {
      for (let j = 0; j < D; j++) {
        let sum = b2Data[b2Off + j];
        for (let i = 0; i < dFF; i++) {
          sum += hMLPAct[t * dFF + i] * w2Data[w2Off + i * D + j];
        }
        mlpOut[t * D + j] = sum;
      }
    }

    // Residual 2: currentH = midH + mlpOut
    const layerOut = new Float32Array(T * D);
    for (let i = 0; i < T * D; i++) layerOut[i] = midH[i] + mlpOut[i];

    layerCaches.push({
      xIn,
      ln1Out,
      ln1XHat,
      ln1InvStd,
      Q,
      K,
      V,
      attnScores,
      attnWeights,
      attnOut,
      projOut,
      midH,
      ln2Out,
      ln2XHat,
      ln2InvStd,
      hMLP,
      hMLPAct,
      mlpOut,
      layerOut,
    });

    currentH = layerOut;
  }

  // 3. Final LayerNorm
  const finalIn = currentH;
  const finalLNOut = new Float32Array(T * D);
  const finalLNXHat = new Float32Array(T * D);
  const finalLNInvStd = new Float32Array(T);

  for (let t = 0; t < T; t++) {
    let sum = 0.0;
    for (let d = 0; d < D; d++) sum += finalIn[t * D + d];
    const mean = sum / D;

    let varSum = 0.0;
    for (let d = 0; d < D; d++) {
      const diff = finalIn[t * D + d] - mean;
      varSum += diff * diff;
    }
    const invStd = 1.0 / Math.sqrt(varSum / D + 1e-5);
    finalLNInvStd[t] = invStd;

    for (let d = 0; d < D; d++) {
      const xHat = (finalIn[t * D + d] - mean) * invStd;
      finalLNXHat[t * D + d] = xHat;
      finalLNOut[t * D + d] = xHat * weights.finalLnGamma.data[weights.finalLnGamma.offset + d] + weights.finalLnBeta.data[weights.finalLnBeta.offset + d];
    }
  }

  // 4. Head Projection: logits [T, V]
  const logits = new Float32Array(T * vocabSize);
  const headData = weights.head.data;
  const headOff = weights.head.offset;

  for (let t = 0; t < T; t++) {
    for (let v = 0; v < vocabSize; v++) {
      let sum = 0.0;
      for (let d = 0; d < D; d++) {
        sum += finalLNOut[t * D + d] * headData[headOff + d * vocabSize + v];
      }
      logits[t * vocabSize + v] = sum;
    }
  }

  // 5. Cross-Entropy Loss
  let totalLoss = 0.0;
  const probs = new Float32Array(T * vocabSize);

  for (let t = 0; t < T; t++) {
    let maxL = -Infinity;
    for (let v = 0; v < vocabSize; v++) {
      const l = logits[t * vocabSize + v];
      if (l > maxL) maxL = l;
    }

    let expSum = 0.0;
    for (let v = 0; v < vocabSize; v++) {
      const e = Math.exp(logits[t * vocabSize + v] - maxL);
      probs[t * vocabSize + v] = e;
      expSum += e;
    }

    const invExpSum = 1.0 / (expSum + 1e-12);
    for (let v = 0; v < vocabSize; v++) {
      probs[t * vocabSize + v] *= invExpSum;
    }

    const tgt = targets[t] % vocabSize;
    const p = Math.max(1e-12, probs[t * vocabSize + tgt]);
    totalLoss += -Math.log(p);
  }

  const loss = totalLoss / T;
  return {
    loss,
    cache: {
      X,
      layerCaches,
      finalIn,
      finalLNOut,
      finalLNXHat,
      finalLNInvStd,
      logits,
      probs,
    },
  };
}

/**
 * Analytical reverse-mode backpropagation for the entire Transformer.
 * Populates `.grad` on all parameter Tensors.
 */
export function backwardLoss(
  weights: TransformerWeights,
  tokens: number[],
  targets: number[],
  config: MiniTransformerConfig,
  cache: any
): void {
  const { dModel, numHeads, headDim, dFF, numLayers, seqLen, vocabSize } = config;
  const T = seqLen;
  const D = dModel;
  const H = numHeads;
  const Dh = headDim;

  // Initialize all grads to zero
  const zeroParamGrad = (p: Tensor) => {
    p.grad = Tensor.zeros(p.shape);
  };

  zeroParamGrad(weights.embedding);
  zeroParamGrad(weights.finalLnGamma);
  zeroParamGrad(weights.finalLnBeta);
  zeroParamGrad(weights.head);

  for (const l of weights.layers) {
    zeroParamGrad(l.ln1Gamma);
    zeroParamGrad(l.ln1Beta);
    zeroParamGrad(l.wq);
    zeroParamGrad(l.wk);
    zeroParamGrad(l.wv);
    zeroParamGrad(l.wo);
    zeroParamGrad(l.ln2Gamma);
    zeroParamGrad(l.ln2Beta);
    zeroParamGrad(l.w1);
    zeroParamGrad(l.b1);
    zeroParamGrad(l.w2);
    zeroParamGrad(l.b2);
  }

  // 1. dLoss / dLogits [T, V]
  const dLogits = new Float32Array(T * vocabSize);
  const invT = 1.0 / T;
  for (let t = 0; t < T; t++) {
    const tgt = targets[t] % vocabSize;
    for (let v = 0; v < vocabSize; v++) {
      const p = cache.probs[t * vocabSize + v];
      dLogits[t * vocabSize + v] = (v === tgt ? (p - 1.0) : p) * invT;
    }
  }

  // 2. Head Projection backward: dHead, dFinalLNOut
  const dFinalLNOut = new Float32Array(T * D);
  const headGrad = weights.head.grad!.data;
  const headOff = weights.head.grad!.offset;
  const headWData = weights.head.data;
  const headWOff = weights.head.offset;

  for (let t = 0; t < T; t++) {
    for (let d = 0; d < D; d++) {
      let dSum = 0.0;
      for (let v = 0; v < vocabSize; v++) {
        const dL = dLogits[t * vocabSize + v];
        dSum += dL * headWData[headWOff + d * vocabSize + v];
        headGrad[headOff + d * vocabSize + v] += cache.finalLNOut[t * D + d] * dL;
      }
      dFinalLNOut[t * D + d] = dSum;
    }
  }

  // 3. Final LayerNorm backward: dFinalIn, dGamma, dBeta
  let dCurH = new Float32Array(T * D);
  const fGammaGrad = weights.finalLnGamma.grad!.data;
  const fBetaGrad = weights.finalLnBeta.grad!.data;
  const fGammaW = weights.finalLnGamma.data;

  for (let t = 0; t < T; t++) {
    const invStd = cache.finalLNInvStd[t];
    let sumDlDxhat = 0.0;
    let sumDlDxhatXhat = 0.0;

    for (let d = 0; d < D; d++) {
      const dL = dFinalLNOut[t * D + d];
      const xHat = cache.finalLNXHat[t * D + d];
      fBetaGrad[weights.finalLnBeta.grad!.offset + d] += dL;
      fGammaGrad[weights.finalLnGamma.grad!.offset + d] += dL * xHat;

      const dXhat = dL * fGammaW[weights.finalLnGamma.offset + d];
      sumDlDxhat += dXhat;
      sumDlDxhatXhat += dXhat * xHat;
    }

    const invD = 1.0 / D;
    for (let d = 0; d < D; d++) {
      const xHat = cache.finalLNXHat[t * D + d];
      const dXhat = dFinalLNOut[t * D + d] * fGammaW[weights.finalLnGamma.offset + d];
      dCurH[t * D + d] = invStd * (dXhat - invD * sumDlDxhat - invD * xHat * sumDlDxhatXhat);
    }
  }

  // 4. Backprop through Layers in reverse order
  for (let l = numLayers - 1; l >= 0; l--) {
    const lw = weights.layers[l];
    const lc = cache.layerCaches[l];

    // Residual 2: dCurH splits to dMidH and dMlpOut
    const dMidH = new Float32Array(dCurH);
    const dMlpOut = new Float32Array(dCurH);

    // MLP W2 and bias2 backward: dHMLPAct, dW2, dB2
    const dHMLPAct = new Float32Array(T * dFF);
    const w2Grad = lw.w2.grad!.data;
    const b2Grad = lw.b2.grad!.data;
    const w2W = lw.w2.data;

    for (let t = 0; t < T; t++) {
      for (let j = 0; j < D; j++) {
        b2Grad[lw.b2.grad!.offset + j] += dMlpOut[t * D + j];
      }
      for (let i = 0; i < dFF; i++) {
        let sum = 0.0;
        for (let j = 0; j < D; j++) {
          const dM = dMlpOut[t * D + j];
          sum += dM * w2W[lw.w2.offset + i * D + j];
          w2Grad[lw.w2.grad!.offset + i * D + j] += lc.hMLPAct[t * dFF + i] * dM;
        }
        dHMLPAct[t * dFF + i] = sum;
      }
    }

    // ReLU backward: dHMLP
    const dHMLP = new Float32Array(T * dFF);
    for (let i = 0; i < T * dFF; i++) {
      dHMLP[i] = lc.hMLP[i] > 0.0 ? dHMLPAct[i] : 0.0;
    }

    // MLP W1 and bias1 backward: dLN2Out, dW1, dB1
    const dLN2Out = new Float32Array(T * D);
    const w1Grad = lw.w1.grad!.data;
    const b1Grad = lw.b1.grad!.data;
    const w1W = lw.w1.data;

    for (let t = 0; t < T; t++) {
      for (let j = 0; j < dFF; j++) {
        b1Grad[lw.b1.grad!.offset + j] += dHMLP[t * dFF + j];
      }
      for (let i = 0; i < D; i++) {
        let sum = 0.0;
        for (let j = 0; j < dFF; j++) {
          const dH = dHMLP[t * dFF + j];
          sum += dH * w1W[lw.w1.offset + i * dFF + j];
          w1Grad[lw.w1.grad!.offset + i * dFF + j] += lc.ln2Out[t * D + i] * dH;
        }
        dLN2Out[t * D + i] = sum;
      }
    }

    // LN2 backward: adds to dMidH
    const ln2GammaGrad = lw.ln2Gamma.grad!.data;
    const ln2BetaGrad = lw.ln2Beta.grad!.data;
    const ln2GammaW = lw.ln2Gamma.data;

    for (let t = 0; t < T; t++) {
      const invStd = lc.ln2InvStd[t];
      let sumDlDxhat = 0.0;
      let sumDlDxhatXhat = 0.0;

      for (let d = 0; d < D; d++) {
        const dL = dLN2Out[t * D + d];
        const xHat = lc.ln2XHat[t * D + d];
        ln2BetaGrad[lw.ln2Beta.grad!.offset + d] += dL;
        ln2GammaGrad[lw.ln2Gamma.grad!.offset + d] += dL * xHat;

        const dXhat = dL * ln2GammaW[lw.ln2Gamma.offset + d];
        sumDlDxhat += dXhat;
        sumDlDxhatXhat += dXhat * xHat;
      }

      const invD = 1.0 / D;
      for (let d = 0; d < D; d++) {
        const xHat = lc.ln2XHat[t * D + d];
        const dXhat = dLN2Out[t * D + d] * ln2GammaW[lw.ln2Gamma.offset + d];
        dMidH[t * D + d] += invStd * (dXhat - invD * sumDlDxhat - invD * xHat * sumDlDxhatXhat);
      }
    }

    // Residual 1: dMidH splits to dXIn and dProjOut
    const dXIn = new Float32Array(dMidH);
    const dProjOut = new Float32Array(dMidH);

    // Output projection Wo backward: dAttnOut, dWo
    const dAttnOut = new Float32Array(T * D);
    const woGrad = lw.wo.grad!.data;
    const woW = lw.wo.data;

    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        let sum = 0.0;
        for (let j = 0; j < D; j++) {
          const dP = dProjOut[t * D + j];
          sum += dP * woW[lw.wo.offset + i * D + j];
          woGrad[lw.wo.grad!.offset + i * D + j] += lc.attnOut[t * D + i] * dP;
        }
        dAttnOut[t * D + i] = sum;
      }
    }

    // Causal Multi-Head Attention backward: dQ, dK, dV
    const dQ = new Float32Array(T * D);
    const dK = new Float32Array(T * D);
    const dV = new Float32Array(T * D);
    const scale = 1.0 / Math.sqrt(Dh);

    for (let h = 0; h < H; h++) {
      const hOff = h * Dh;
      for (let i = 0; i < T; i++) {
        // dAttnOut[i, hOff + d] = sum_j attnWeights[h, i, j] * V[j, hOff + d]
        const dAttnWeights = new Float32Array(T);
        for (let j = 0; j <= i; j++) {
          let sumW = 0.0;
          for (let d = 0; d < Dh; d++) {
            const dA = dAttnOut[i * D + hOff + d];
            sumW += dA * lc.V[j * D + hOff + d];
            dV[j * D + hOff + d] += lc.attnWeights[h * T * T + i * T + j] * dA;
          }
          dAttnWeights[j] = sumW;
        }

        // Softmax backward for row i
        let sumW_P = 0.0;
        for (let j = 0; j <= i; j++) {
          sumW_P += dAttnWeights[j] * lc.attnWeights[h * T * T + i * T + j];
        }

        for (let j = 0; j <= i; j++) {
          const P_ij = lc.attnWeights[h * T * T + i * T + j];
          const dScore = P_ij * (dAttnWeights[j] - sumW_P) * scale;

          for (let d = 0; d < Dh; d++) {
            dQ[i * D + hOff + d] += dScore * lc.K[j * D + hOff + d];
            dK[j * D + hOff + d] += dScore * lc.Q[i * D + hOff + d];
          }
        }
      }
    }

    // QKV projections backward: dLN1Out, dWq, dWk, dWv
    const dLN1Out = new Float32Array(T * D);
    const wqGrad = lw.wq.grad!.data;
    const wkGrad = lw.wk.grad!.data;
    const wvGrad = lw.wv.grad!.data;
    const wqW = lw.wq.data;
    const wkW = lw.wk.data;
    const wvW = lw.wv.data;

    for (let t = 0; t < T; t++) {
      for (let i = 0; i < D; i++) {
        let sum = 0.0;
        for (let j = 0; j < D; j++) {
          const dq = dQ[t * D + j];
          const dk = dK[t * D + j];
          const dv = dV[t * D + j];
          sum += dq * wqW[lw.wq.offset + i * D + j] + dk * wkW[lw.wk.offset + i * D + j] + dv * wvW[lw.wv.offset + i * D + j];
          wqGrad[lw.wq.grad!.offset + i * D + j] += lc.ln1Out[t * D + i] * dq;
          wkGrad[lw.wk.grad!.offset + i * D + j] += lc.ln1Out[t * D + i] * dk;
          wvGrad[lw.wv.grad!.offset + i * D + j] += lc.ln1Out[t * D + i] * dv;
        }
        dLN1Out[t * D + i] = sum;
      }
    }

    // LN1 backward: adds to dXIn
    const ln1GammaGrad = lw.ln1Gamma.grad!.data;
    const ln1BetaGrad = lw.ln1Beta.grad!.data;
    const ln1GammaW = lw.ln1Gamma.data;

    for (let t = 0; t < T; t++) {
      const invStd = lc.ln1InvStd[t];
      let sumDlDxhat = 0.0;
      let sumDlDxhatXhat = 0.0;

      for (let d = 0; d < D; d++) {
        const dL = dLN1Out[t * D + d];
        const xHat = lc.ln1XHat[t * D + d];
        ln1BetaGrad[lw.ln1Beta.grad!.offset + d] += dL;
        ln1GammaGrad[lw.ln1Gamma.grad!.offset + d] += dL * xHat;

        const dXhat = dL * ln1GammaW[lw.ln1Gamma.offset + d];
        sumDlDxhat += dXhat;
        sumDlDxhatXhat += dXhat * xHat;
      }

      const invD = 1.0 / D;
      for (let d = 0; d < D; d++) {
        const xHat = lc.ln1XHat[t * D + d];
        const dXhat = dLN1Out[t * D + d] * ln1GammaW[lw.ln1Gamma.offset + d];
        dXIn[t * D + d] += invStd * (dXhat - invD * sumDlDxhat - invD * xHat * sumDlDxhatXhat);
      }
    }

    dCurH = dXIn;
  }

  // 5. Embedding table backward
  const embGrad = weights.embedding.grad!.data;
  const embOff = weights.embedding.grad!.offset;
  for (let t = 0; t < T; t++) {
    const tok = tokens[t] % vocabSize;
    for (let d = 0; d < D; d++) {
      embGrad[embOff + tok * D + d] += dCurH[t * D + d];
    }
  }
}

async function runFullTransformerGradCheck() {
  console.log('='.repeat(70));
  console.log('TASK 3: FULL TRANSFORMER FINITE-DIFFERENCE GRADIENT CHECK');
  console.log('Config: 2 Layers, d_model=32, 2 Heads (head_dim=16), d_ff=64, T=8, V=32');
  console.log('='.repeat(70));

  const config: MiniTransformerConfig = {
    vocabSize: 32,
    dModel: 32,
    numHeads: 2,
    headDim: 16,
    dFF: 64,
    numLayers: 2,
    seqLen: 8,
  };

  const weights = createMiniTransformer(config, 42);
  const tokens = [3, 14, 15, 9, 26, 5, 31, 0];
  const targets = [14, 15, 9, 26, 5, 31, 0, 7];

  // 1. Forward and Analytical Backward Pass
  console.log('\n[1] Computing Analytical Gradients via Reverse-Mode Autograd...');
  const { loss, cache } = forwardLoss(weights, tokens, targets, config);
  console.log(`  Initial Cross-Entropy Loss: ${loss.toFixed(6)}`);

  backwardLoss(weights, tokens, targets, config, cache);

  // 2. Finite-Difference Check on EVERY Parameter Group
  console.log('\n[2] Performing Finite-Difference Gradient Checks...');

  const paramGroups: Array<{ name: string; tensor: Tensor }> = [
    { name: 'Embedding Table', tensor: weights.embedding },
    { name: 'Layer 0 LN1 Gamma', tensor: weights.layers[0].ln1Gamma },
    { name: 'Layer 0 LN1 Beta', tensor: weights.layers[0].ln1Beta },
    { name: 'Layer 0 Wq', tensor: weights.layers[0].wq },
    { name: 'Layer 0 Wk', tensor: weights.layers[0].wk },
    { name: 'Layer 0 Wv', tensor: weights.layers[0].wv },
    { name: 'Layer 0 Wo', tensor: weights.layers[0].wo },
    { name: 'Layer 0 LN2 Gamma', tensor: weights.layers[0].ln2Gamma },
    { name: 'Layer 0 LN2 Beta', tensor: weights.layers[0].ln2Beta },
    { name: 'Layer 0 MLP W1', tensor: weights.layers[0].w1 },
    { name: 'Layer 0 MLP B1', tensor: weights.layers[0].b1 },
    { name: 'Layer 0 MLP W2', tensor: weights.layers[0].w2 },
    { name: 'Layer 0 MLP B2', tensor: weights.layers[0].b2 },
    { name: 'Layer 1 LN1 Gamma', tensor: weights.layers[1].ln1Gamma },
    { name: 'Layer 1 LN1 Beta', tensor: weights.layers[1].ln1Beta },
    { name: 'Layer 1 Wq', tensor: weights.layers[1].wq },
    { name: 'Layer 1 Wk', tensor: weights.layers[1].wk },
    { name: 'Layer 1 Wv', tensor: weights.layers[1].wv },
    { name: 'Layer 1 Wo', tensor: weights.layers[1].wo },
    { name: 'Layer 1 LN2 Gamma', tensor: weights.layers[1].ln2Gamma },
    { name: 'Layer 1 LN2 Beta', tensor: weights.layers[1].ln2Beta },
    { name: 'Layer 1 MLP W1', tensor: weights.layers[1].w1 },
    { name: 'Layer 1 MLP B1', tensor: weights.layers[1].b1 },
    { name: 'Layer 1 MLP W2', tensor: weights.layers[1].w2 },
    { name: 'Layer 1 MLP B2', tensor: weights.layers[1].b2 },
    { name: 'Final LN Gamma', tensor: weights.finalLnGamma },
    { name: 'Final LN Beta', tensor: weights.finalLnBeta },
    { name: 'Unembedding Head', tensor: weights.head },
  ];

  let allPassed = true;
  const resultsTable: any[] = [];

  for (const pg of paramGroups) {
    const fLossForParam = (x: Tensor) => {
      // Temporarily copy perturbed values into parameter tensor buffer in-place
      const off = pg.tensor.offset;
      const sz = pg.tensor.size;
      const orig = new Float32Array(pg.tensor.data.subarray(off, off + sz));
      pg.tensor.data.set(x.data.subarray(x.offset, x.offset + sz), off);
      const res = forwardLoss(weights, tokens, targets, config);
      pg.tensor.data.set(orig, off);
      return res.loss;
    };

    const checkRes = GradCheck.check(fLossForParam, pg.tensor, pg.tensor.grad!, {
      eps: 1e-3,
      rtol: 2e-2, // 2% relative tolerance for 32-bit floats
      atol: 2e-3,
      maxSamples: 32,
    });

    if (!checkRes.passed) allPassed = false;

    resultsTable.push({
      group: pg.name,
      shape: JSON.stringify(pg.tensor.shape),
      size: pg.tensor.size,
      maxAbsDiff: checkRes.maxAbsError.toExponential(4),
      maxRelDiff: checkRes.maxRelError.toExponential(4),
      passed: checkRes.passed ? '✅ PASS' : '❌ FAIL',
    });
  }

  console.table(resultsTable);

  console.log('='.repeat(70));
  const passedCount = resultsTable.filter((r) => r.passed.includes('PASS')).length;
  console.log(`GRADIENT CHECK SUMMARY: ${passedCount} / ${resultsTable.length} PARAMETER GROUPS PASSED`);
  console.log(`OVERALL STATUS: ${allPassed ? '✅ 100% GRADIENTS VERIFIED AGAINST FINITE DIFFERENCE' : '❌ FAIL'}`);
  console.log('='.repeat(70));

  if (!allPassed) {
    process.exit(1);
  }
}

runFullTransformerGradCheck().catch((err) => {
  console.error('Transformer GradCheck failed:', err);
  process.exit(1);
});
