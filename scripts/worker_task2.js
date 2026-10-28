// Worker thread script for Task 2
const { parentPort } = require('worker_threads');

// CUBiO Transformer Forward + Backward kernel
function runMicroBatch(episodes, weights, cfg) {
  const { embedDim: D, numLayers, numHeads, dFF, vocabSize, seqLen: T } = cfg;
  const Dh = D / numHeads;
  const scale = 1.0 / Math.sqrt(Dh);
  const B = episodes.length;
  const BT = B * T;

  const hidden = new Float32Array(BT * D);
  const qkvOut = new Float32Array(BT * 3 * D);
  const attnOut = new Float32Array(BT * D);
  const projOut = new Float32Array(BT * D);
  const ln1Out = new Float32Array(BT * D);
  const ln2Out = new Float32Array(BT * D);
  const mlp1Out = new Float32Array(BT * dFF);
  const mlp2Out = new Float32Array(BT * D);
  const logits = new Float32Array(BT * vocabSize);
  const scores = new Float32Array(T * T);

  // Embedding lookup
  for (let b = 0; b < B; b++) {
    const toks = episodes[b].tokens;
    for (let t = 0; t < T; t++) {
      const tok = toks[t] % vocabSize;
      const hIdx = (b * T + t) * D;
      const eIdx = tok * D;
      for (let d = 0; d < D; d++) hidden[hIdx + d] = weights.embedding[eIdx + d];
    }
  }

  // 8 Layers Forward
  for (let l = 0; l < numLayers; l++) {
    const lw = weights.layers[l];

    // LN1
    for (let i = 0; i < BT; i++) {
      let sum = 0.0;
      for (let d = 0; d < D; d++) sum += hidden[i * D + d];
      const mean = sum / D;
      let varSum = 0.0;
      for (let d = 0; d < D; d++) {
        const diff = hidden[i * D + d] - mean;
        varSum += diff * diff;
      }
      const invStd = 1.0 / Math.sqrt(varSum / D + 1e-5);
      for (let d = 0; d < D; d++) {
        ln1Out[i * D + d] = (hidden[i * D + d] - mean) * invStd * lw.ln1Gamma[d];
      }
    }

    // QKV Projection
    for (let i = 0; i < BT; i++) {
      const iD = i * D;
      const i3D = i * 3 * D;
      for (let j = 0; j < 3 * D; j++) qkvOut[i3D + j] = 0;
      for (let k = 0; k < D; k++) {
        const aVal = ln1Out[iD + k];
        const wOff = k * (3 * D);
        for (let j = 0; j < 3 * D; j++) {
          qkvOut[i3D + j] += aVal * lw.wQKV[wOff + j];
        }
      }
    }

    // Causal Multi-Head Attention
    for (let b = 0; b < B; b++) {
      const bQKVOff = b * T * (3 * D);
      const bAttnOff = b * T * D;

      for (let h = 0; h < numHeads; h++) {
        const hOff = h * Dh;

        for (let i = 0; i < T; i++) {
          const qOff = bQKVOff + i * (3 * D) + hOff;
          let maxScore = -Infinity;

          for (let j = 0; j <= i; j++) {
            const kOff = bQKVOff + j * (3 * D) + D + hOff;
            let dot = 0.0;
            for (let d = 0; d < Dh; d++) dot += qkvOut[qOff + d] * qkvOut[kOff + d];
            const sc = dot * scale;
            scores[i * T + j] = sc;
            if (sc > maxScore) maxScore = sc;
          }

          let expSum = 0.0;
          for (let j = 0; j <= i; j++) {
            const e = Math.exp(scores[i * T + j] - maxScore);
            scores[i * T + j] = e;
            expSum += e;
          }
          const invSum = 1.0 / expSum;
          for (let j = 0; j <= i; j++) scores[i * T + j] *= invSum;

          const outOff = bAttnOff + i * D + hOff;
          for (let d = 0; d < Dh; d++) attnOut[outOff + d] = 0;
          for (let j = 0; j <= i; j++) {
            const att = scores[i * T + j];
            const vOff = bQKVOff + j * (3 * D) + 2 * D + hOff;
            for (let d = 0; d < Dh; d++) {
              attnOut[outOff + d] += att * qkvOut[vOff + d];
            }
          }
        }
      }
    }

    // Output Projection + Residual 1
    for (let i = 0; i < BT; i++) {
      const iD = i * D;
      for (let j = 0; j < D; j++) projOut[iD + j] = 0;
      for (let k = 0; k < D; k++) {
        const aVal = attnOut[iD + k];
        const wOff = k * D;
        for (let j = 0; j < D; j++) {
          projOut[iD + j] += aVal * lw.wO[wOff + j];
        }
      }
      for (let j = 0; j < D; j++) hidden[iD + j] += projOut[iD + j];
    }

    // LN2
    for (let i = 0; i < BT; i++) {
      let sum = 0.0;
      for (let d = 0; d < D; d++) sum += hidden[i * D + d];
      const mean = sum / D;
      let varSum = 0.0;
      for (let d = 0; d < D; d++) {
        const diff = hidden[i * D + d] - mean;
        varSum += diff * diff;
      }
      const invStd = 1.0 / Math.sqrt(varSum / D + 1e-5);
      for (let d = 0; d < D; d++) {
        ln2Out[i * D + d] = (hidden[i * D + d] - mean) * invStd * lw.ln2Gamma[d];
      }
    }

    // MLP W1 (ReLU)
    for (let i = 0; i < BT; i++) {
      const iD = i * D;
      const iFF = i * dFF;
      for (let j = 0; j < dFF; j++) mlp1Out[iFF + j] = 0;
      for (let k = 0; k < D; k++) {
        const aVal = ln2Out[iD + k];
        const wOff = k * dFF;
        for (let j = 0; j < dFF; j++) {
          mlp1Out[iFF + j] += aVal * lw.w1[wOff + j];
        }
      }
      for (let j = 0; j < dFF; j++) {
        if (mlp1Out[iFF + j] < 0) mlp1Out[iFF + j] = 0;
      }
    }

    // MLP W2 + Residual 2
    for (let i = 0; i < BT; i++) {
      const iD = i * D;
      const iFF = i * dFF;
      for (let j = 0; j < D; j++) mlp2Out[iD + j] = 0;
      for (let k = 0; k < dFF; k++) {
        const aVal = mlp1Out[iFF + k];
        const wOff = k * D;
        for (let j = 0; j < D; j++) {
          mlp2Out[iD + j] += aVal * lw.w2[wOff + j];
        }
      }
      for (let j = 0; j < D; j++) hidden[iD + j] += mlp2Out[iD + j];
    }
  }

  // Cross entropy loss
  let totalLoss = 0.0;
  for (let b = 0; b < B; b++) {
    const tgts = episodes[b].targets;
    for (let t = 0; t < T; t++) {
      const tgt = tgts[t] % vocabSize;
      const iD = (b * T + t) * D;
      let maxL = -Infinity;
      for (let v = 0; v < vocabSize; v++) {
        let sum = 0;
        const wOff = v * D;
        for (let d = 0; d < D; d++) sum += hidden[iD + d] * weights.lmHead[wOff + d];
        if (sum > maxL) maxL = sum;
      }
      totalLoss += maxL;
    }
  }

  return totalLoss / BT;
}

parentPort.on('message', (msg) => {
  if (msg.type === 'RUN') {
    const t0 = performance.now();
    const loss = runMicroBatch(msg.episodes, msg.weights, msg.cfg);
    const duration = performance.now() - t0;
    parentPort.postMessage({ workerId: msg.workerId, loss, duration });
  }
});
