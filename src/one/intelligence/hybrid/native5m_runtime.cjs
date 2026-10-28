var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// E:/3D memory studio/scripts/one_language_bridge_export.ts
var one_language_bridge_export_exports = {};
__export(one_language_bridge_export_exports, {
  CUBIO_NATIVE_MODEL_ID: () => CUBIO_NATIVE_MODEL_ID,
  CheckpointManager: () => CheckpointManager,
  CubiONativeModel: () => CubiONativeModel,
  EpistemicStatus: () => EpistemicStatus,
  NativeInferenceEngine: () => NativeInferenceEngine,
  NativeModelLoader: () => NativeModelLoader,
  NativeTokenizer: () => NativeTokenizer,
  NativeVocabularyV2Builder: () => NativeVocabularyV2Builder
});
module.exports = __toCommonJS(one_language_bridge_export_exports);

// E:/3D memory studio/src/cubio/model/native_foundation/checkpoint_manager.ts
var import_crypto = require("crypto");
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);

// E:/3D memory studio/src/cubio/model/native_foundation/native_model_types.ts
var CUBIO_NATIVE_MODEL_ID = "CUBIO-NATIVE-MODEL-V1";
var PROHIBITED_EXTERNAL_MODEL_IDENTIFIERS = [
  "qwen",
  "qwen1.5",
  "qwen2",
  "qwen2.5",
  "llama",
  "llama2",
  "llama3",
  "mistral",
  "mixtral",
  "gemma",
  "gpt",
  "gpt-3",
  "gpt-4",
  "claude",
  "gemini",
  "bert",
  "roberta",
  "t5",
  "falcon",
  "deepseek",
  "phi",
  "phi-2",
  "phi-3",
  "chinchilla",
  "palm"
];
var FORBIDDEN_ACTUATION_PATTERNS = [
  "actuate_motor",
  "gpio_write",
  "usb_transmit",
  "robotic_arm",
  "hardware_override",
  "relay_trigger",
  "servo_set_angle"
];
var EpistemicStatus = /* @__PURE__ */ ((EpistemicStatus2) => {
  EpistemicStatus2["FACT"] = "FACT";
  EpistemicStatus2["OBSERVATION"] = "OBSERVATION";
  EpistemicStatus2["DERIVATION"] = "DERIVATION";
  EpistemicStatus2["HYPOTHESIS"] = "HYPOTHESIS";
  EpistemicStatus2["PREDICTION"] = "PREDICTION";
  EpistemicStatus2["ASSUMPTION"] = "ASSUMPTION";
  EpistemicStatus2["UNKNOWN"] = "UNKNOWN";
  return EpistemicStatus2;
})(EpistemicStatus || {});

// E:/3D memory studio/src/cubio/model/native_foundation/external_model_guard.ts
var ExternalModelDependencyError = class extends Error {
  constructor(modelName) {
    super(`[EXTERNAL_MODEL_BLOCKED] Attempted invocation of external pretrained model '${modelName}'. CUBiO operates strictly on sovereign native models.`);
    this.name = "ExternalModelDependencyError";
  }
};
var ActuationBlockedError = class extends Error {
  constructor(action) {
    super(`[ACTUATION_BLOCKED] Attempted physical actuation command '${action}'. Hardware actuation is permanently locked out.`);
    this.name = "ActuationBlockedError";
  }
};
var NetworkAccessBlockedError = class extends Error {
  constructor(url) {
    super(`[NETWORK_BLOCKED] Attempted remote network access to '${url}'. CUBiO native model training operates strictly in sovereign offline mode.`);
    this.name = "NetworkAccessBlockedError";
  }
};
var ExternalModelGuard = class {
  static {
    this.interceptedCalls = 0;
  }
  static {
    this.blockedActuations = 0;
  }
  static {
    this.blockedNetworkCalls = 0;
  }
  /**
   * Asserts that a model identifier is NOT an external pretrained model.
   * Throws ExternalModelDependencyError if prohibited.
   */
  static assertNativeOnly(modelIdentifier) {
    const lower = modelIdentifier.toLowerCase().trim();
    for (const prohibited of PROHIBITED_EXTERNAL_MODEL_IDENTIFIERS) {
      if (prohibited === "phi") {
        if (lower === "phi" || lower.includes("phi-") || lower.includes("phi_") || lower.includes("phi1") || lower.includes("phi2") || lower.includes("phi3") || lower.includes("phi4")) {
          this.interceptedCalls++;
          throw new ExternalModelDependencyError(modelIdentifier);
        }
      } else if (prohibited === "t5") {
        if (lower === "t5" || lower.includes("t5-") || lower.includes("t5_") || lower.includes("flan-t5")) {
          this.interceptedCalls++;
          throw new ExternalModelDependencyError(modelIdentifier);
        }
      } else if (lower.includes(prohibited)) {
        this.interceptedCalls++;
        throw new ExternalModelDependencyError(modelIdentifier);
      }
    }
  }
  /**
   * Asserts that an actuation command or intent is blocked.
   */
  static assertActuationBlocked(command) {
    const lower = command.toLowerCase().trim();
    for (const forbidden of FORBIDDEN_ACTUATION_PATTERNS) {
      if (lower.includes(forbidden)) {
        this.blockedActuations++;
        throw new ActuationBlockedError(command);
      }
    }
  }
  /**
   * Asserts that network access is blocked.
   */
  static assertNetworkBlocked(targetUrl) {
    this.blockedNetworkCalls++;
    throw new NetworkAccessBlockedError(targetUrl);
  }
  static getInterceptedCount() {
    return this.interceptedCalls;
  }
  static getBlockedActuationsCount() {
    return this.blockedActuations;
  }
  static getBlockedNetworkCallsCount() {
    return this.blockedNetworkCalls;
  }
  static resetCounters() {
    this.interceptedCalls = 0;
    this.blockedActuations = 0;
    this.blockedNetworkCalls = 0;
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/checkpoint_manager.ts
var CheckpointManager = class {
  /**
   * Creates a sealed NativeModelCheckpoint container from a trained model instance
   */
  static createCheckpoint(model, trainingRunId, lineageParentStateHash, evaluationScore = 1) {
    ExternalModelGuard.assertNativeOnly(model.modelId);
    const weights = model.getWeights();
    const inventory = model.getParameterInventory();
    const modelStateHash = model.computeWeightsHash();
    const merkleHash = (0, import_crypto.createHash)("sha256");
    for (const t of inventory.tensors) {
      merkleHash.update(`${t.tensorName}:${t.parameterCount}`);
    }
    const weightsMerkleRoot = merkleHash.digest("hex");
    const checkpointId = `CHK_NATIVE_${Date.now()}_${modelStateHash.slice(0, 8)}`;
    return Object.freeze({
      checkpointId,
      modelId: model.modelId || CUBIO_NATIVE_MODEL_ID,
      containerType: "CUBIO_NATIVE_MODEL_CHECKPOINT_V1",
      architectureVersion: "1.0.0",
      vocabularyVersion: "1.0.0",
      trainingRunId,
      lineageParentStateHash,
      modelStateHash,
      weightsMerkleRoot,
      parameterInventory: inventory,
      weights: {
        tokenEmbedding: weights.tokenEmbedding,
        positionalEmbedding: weights.positionalEmbedding,
        spatialEmbedding: weights.spatialEmbedding,
        layers: weights.layers,
        epistemicHead: weights.epistemicHead,
        lmHead: weights.lmHead
      },
      evaluationScore,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  static {
    this.BINARY_MAGIC = "CUBIO_BIN_CHK_V1";
  }
  /**
   * Serializes a NativeModelWeights structure into a flat Float32Array
   */
  static packWeights(weights, config) {
    const D = config?.embedDim ?? (weights.tokenEmbedding?.[0]?.length || 256);
    const dFF = config?.embedDim ? config.embedDim * 2 : weights.layers?.[0]?.ffn1Weight?.[0]?.length || 512;
    const V = config?.vocabSize ?? (weights.tokenEmbedding?.length || 1024);
    const S = config?.numSpatialCells ?? (weights.spatialEmbedding?.length || 343);
    const maxSeqLen = config?.maxSeqLen ?? (weights.positionalEmbedding?.length || 320);
    const numLayers = weights.layers?.length || 8;
    const total = V * D + maxSeqLen * D + S * D + numLayers * (4 * D * D + D + D * dFF + dFF * D + D) + D * 7 + D * V;
    const flat = new Float32Array(total);
    let off = 0;
    for (let i = 0; i < V; i++) {
      flat.set(weights.tokenEmbedding[i], off);
      off += D;
    }
    for (let i = 0; i < maxSeqLen; i++) {
      flat.set(weights.positionalEmbedding[i], off);
      off += D;
    }
    for (let i = 0; i < S; i++) {
      flat.set(weights.spatialEmbedding[i], off);
      off += D;
    }
    for (let l = 0; l < numLayers; l++) {
      const lw = weights.layers[l];
      for (let j = 0; j < D; j++) {
        flat.set(lw.qWeight[j], off);
        off += D;
      }
      for (let j = 0; j < D; j++) {
        flat.set(lw.kWeight[j], off);
        off += D;
      }
      for (let j = 0; j < D; j++) {
        flat.set(lw.vWeight[j], off);
        off += D;
      }
      for (let j = 0; j < D; j++) {
        flat.set(lw.outWeight[j], off);
        off += D;
      }
      flat.set(lw.norm1Gamma, off);
      off += D;
      for (let j = 0; j < D; j++) {
        flat.set(lw.ffn1Weight[j], off);
        off += dFF;
      }
      for (let j = 0; j < dFF; j++) {
        flat.set(lw.ffn2Weight[j], off);
        off += D;
      }
      flat.set(lw.norm2Gamma, off);
      off += D;
    }
    for (let j = 0; j < D; j++) {
      flat.set(weights.epistemicHead[j], off);
      off += 7;
    }
    for (let j = 0; j < D; j++) {
      flat.set(weights.lmHead[j], off);
      off += V;
    }
    return flat;
  }
  /**
   * Unpacks a flat Float32Array into a NativeModelWeights structure
   */
  static unpackWeights(flat, config) {
    const D = config?.embedDim ?? 256;
    const dFF = config?.embedDim ? config.embedDim * 2 : 512;
    const V = config?.vocabSize ?? 1024;
    const S = config?.numSpatialCells ?? 343;
    const maxSeqLen = config?.maxSeqLen ?? 320;
    const numLayers = config?.numLayers ?? 8;
    let off = 0;
    const tokenEmbedding = [];
    for (let i = 0; i < V; i++) {
      tokenEmbedding.push(Array.from(flat.subarray(off, off + D)));
      off += D;
    }
    const positionalEmbedding = [];
    for (let i = 0; i < maxSeqLen; i++) {
      positionalEmbedding.push(Array.from(flat.subarray(off, off + D)));
      off += D;
    }
    const spatialEmbedding = [];
    for (let i = 0; i < S; i++) {
      spatialEmbedding.push(Array.from(flat.subarray(off, off + D)));
      off += D;
    }
    const layers = [];
    for (let l = 0; l < numLayers; l++) {
      const qWeight = [];
      for (let j = 0; j < D; j++) {
        qWeight.push(Array.from(flat.subarray(off, off + D)));
        off += D;
      }
      const kWeight = [];
      for (let j = 0; j < D; j++) {
        kWeight.push(Array.from(flat.subarray(off, off + D)));
        off += D;
      }
      const vWeight = [];
      for (let j = 0; j < D; j++) {
        vWeight.push(Array.from(flat.subarray(off, off + D)));
        off += D;
      }
      const outWeight = [];
      for (let j = 0; j < D; j++) {
        outWeight.push(Array.from(flat.subarray(off, off + D)));
        off += D;
      }
      const norm1Gamma = Array.from(flat.subarray(off, off + D));
      off += D;
      const ffn1Weight = [];
      for (let j = 0; j < D; j++) {
        ffn1Weight.push(Array.from(flat.subarray(off, off + dFF)));
        off += dFF;
      }
      const ffn2Weight = [];
      for (let j = 0; j < dFF; j++) {
        ffn2Weight.push(Array.from(flat.subarray(off, off + D)));
        off += D;
      }
      const norm2Gamma = Array.from(flat.subarray(off, off + D));
      off += D;
      layers.push({ qWeight, kWeight, vWeight, outWeight, norm1Gamma, ffn1Weight, ffn2Weight, norm2Gamma });
    }
    const epistemicHead = [];
    for (let j = 0; j < D; j++) {
      epistemicHead.push(Array.from(flat.subarray(off, off + 7)));
      off += 7;
    }
    const lmHead = [];
    for (let j = 0; j < D; j++) {
      lmHead.push(Array.from(flat.subarray(off, off + V)));
      off += V;
    }
    return {
      tokenEmbedding,
      positionalEmbedding,
      spatialEmbedding,
      layers,
      epistemicHead,
      lmHead
    };
  }
  /**
   * Saves a checkpoint to disk in high-efficiency binary format (CUBIO_BIN_CHK_V1)
   */
  static saveBinaryCheckpoint(checkpoint, targetPath) {
    if (targetPath.endsWith(".3dmemory") || targetPath.includes(".3dmemory")) {
      throw new Error("[DOMAIN_CONFLATION_ERROR] Cannot save native model weights into a .3dmemory cognitive memory container!");
    }
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const flatWeights = this.packWeights(checkpoint.weights);
    const meta = {
      checkpointId: checkpoint.checkpointId,
      modelId: checkpoint.modelId,
      containerType: checkpoint.containerType,
      architectureVersion: checkpoint.architectureVersion,
      vocabularyVersion: checkpoint.vocabularyVersion,
      trainingRunId: checkpoint.trainingRunId,
      lineageParentStateHash: checkpoint.lineageParentStateHash,
      modelStateHash: checkpoint.modelStateHash,
      weightsMerkleRoot: checkpoint.weightsMerkleRoot,
      parameterInventory: checkpoint.parameterInventory,
      evaluationScore: checkpoint.evaluationScore,
      createdAt: checkpoint.createdAt,
      binaryFormat: "FLOAT32_LITTLE_ENDIAN",
      totalParameters: flatWeights.length
    };
    const metaJson = JSON.stringify(meta);
    const metaBuf = Buffer.from(metaJson, "utf-8");
    const magicBuf = Buffer.alloc(16);
    magicBuf.write(this.BINARY_MAGIC, "utf-8");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(metaBuf.length, 0);
    const weightsBuf = Buffer.from(flatWeights.buffer, flatWeights.byteOffset, flatWeights.byteLength);
    const combined = Buffer.concat([magicBuf, lenBuf, metaBuf, weightsBuf]);
    fs.writeFileSync(targetPath, combined);
    return targetPath;
  }
  /**
   * Saves a checkpoint to disk inside a dedicated checkpoints directory (default: binary format)
   */
  static saveCheckpoint(checkpoint, targetDir, useBinary = true) {
    if (targetDir.endsWith(".3dmemory") || targetDir.includes(".3dmemory")) {
      throw new Error("[DOMAIN_CONFLATION_ERROR] Cannot save native model weights into a .3dmemory cognitive memory container!");
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filename = `${checkpoint.checkpointId}.cubiomodel`;
    const targetPath = path.join(targetDir, filename);
    if (useBinary) {
      return this.saveBinaryCheckpoint(checkpoint, targetPath);
    }
    fs.writeFileSync(targetPath, JSON.stringify(checkpoint, null, 2), "utf-8");
    return targetPath;
  }
  /**
   * Loads a checkpoint from disk (backward-compatible: supports both CUBIO_BIN_CHK_V1 binary and legacy JSON)
   */
  static loadCheckpoint(filePath) {
    if (filePath.endsWith(".3dmemory")) {
      throw new Error("[DOMAIN_CONFLATION_ERROR] Cannot load model checkpoint from a .3dmemory cognitive store!");
    }
    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length >= 20) {
      const magic = fileBuffer.subarray(0, 16).toString("utf-8").replace(/\0/g, "");
      if (magic === this.BINARY_MAGIC) {
        const headerLen = fileBuffer.readUInt32LE(16);
        const headerJson = fileBuffer.subarray(20, 20 + headerLen).toString("utf-8");
        const meta = JSON.parse(headerJson);
        const weightsOffset = 20 + headerLen;
        const weightsBuffer = fileBuffer.subarray(weightsOffset);
        let flatWeights;
        if (weightsBuffer.byteOffset % 4 === 0) {
          flatWeights = new Float32Array(
            weightsBuffer.buffer,
            weightsBuffer.byteOffset,
            Math.floor(weightsBuffer.byteLength / 4)
          );
        } else {
          const alignedBuffer = new ArrayBuffer(weightsBuffer.byteLength);
          new Uint8Array(alignedBuffer).set(weightsBuffer);
          flatWeights = new Float32Array(alignedBuffer, 0, Math.floor(weightsBuffer.byteLength / 4));
        }
        const weights = this.unpackWeights(flatWeights);
        return Object.freeze({
          checkpointId: meta.checkpointId,
          modelId: meta.modelId || CUBIO_NATIVE_MODEL_ID,
          containerType: "CUBIO_NATIVE_MODEL_CHECKPOINT_V1",
          architectureVersion: meta.architectureVersion || "1.0.0",
          vocabularyVersion: meta.vocabularyVersion || "1.0.0",
          trainingRunId: meta.trainingRunId || "UNKNOWN",
          lineageParentStateHash: meta.lineageParentStateHash ?? null,
          modelStateHash: meta.modelStateHash,
          weightsMerkleRoot: meta.weightsMerkleRoot,
          parameterInventory: meta.parameterInventory,
          weights,
          evaluationScore: meta.evaluationScore ?? 1,
          createdAt: meta.createdAt || (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    const content = fileBuffer.toString("utf-8");
    const parsed = JSON.parse(content);
    if (parsed.containerType !== "CUBIO_NATIVE_MODEL_CHECKPOINT_V1") {
      throw new Error(`Invalid container type in ${filePath}: ${parsed.containerType}`);
    }
    return parsed;
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_model_architecture.ts
var import_crypto2 = require("crypto");
var DeterministicPRNG = class {
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    let t = this.state += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  nextRange(min, max) {
    return min + this.next() * (max - min);
  }
  nextMatrix(rows, cols, scale) {
    const mat = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push(this.nextRange(-scale, scale));
      }
      mat.push(row);
    }
    return mat;
  }
};
var CubiONativeModel = class {
  constructor(config) {
    this.modelId = CUBIO_NATIVE_MODEL_ID;
    ExternalModelGuard.assertNativeOnly(config.modelId);
    ExternalModelGuard.assertNativeOnly(config.architectureId);
    this.config = config;
    const { weights, inventory } = this.initializeWeightsAndInventory();
    this.weights = weights;
    this.parameterInventory = inventory;
    this.totalParameters = inventory.totalParameters;
  }
  /**
   * Initializes model parameters and builds exact parameter inventory
   */
  initializeWeightsAndInventory() {
    const prng = new DeterministicPRNG(this.config.masterSeed);
    const { vocabSize, embedDim, numLayers, maxSeqLen, numSpatialCells } = this.config;
    const scale = Math.sqrt(2 / embedDim);
    const tensorRecords = [];
    const tokenEmbedding = prng.nextMatrix(vocabSize, embedDim, scale);
    const tokenParams = vocabSize * embedDim;
    tensorRecords.push({
      tensorName: "embeddings.token_embeddings.weight",
      shape: [vocabSize, embedDim],
      dtype: "float32",
      parameterCount: tokenParams,
      trainable: true,
      initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
      checkpointLocation: "weights/embeddings.token_embeddings.weight"
    });
    const positionalEmbedding = prng.nextMatrix(maxSeqLen, embedDim, scale * 0.5);
    const posParams = maxSeqLen * embedDim;
    tensorRecords.push({
      tensorName: "embeddings.position_embeddings.weight",
      shape: [maxSeqLen, embedDim],
      dtype: "float32",
      parameterCount: posParams,
      trainable: true,
      initializationMethod: "DeterministicPRNG(Mulberry32)_SineScaled",
      checkpointLocation: "weights/embeddings.position_embeddings.weight"
    });
    const spatialEmbedding = prng.nextMatrix(numSpatialCells, embedDim, scale * 0.5);
    const spatialParams = numSpatialCells * embedDim;
    tensorRecords.push({
      tensorName: "embeddings.spatial_hcp_lattice.weight",
      shape: [numSpatialCells, embedDim],
      dtype: "float32",
      parameterCount: spatialParams,
      trainable: true,
      initializationMethod: "DeterministicPRNG(Mulberry32)_HCP_Harmonic",
      checkpointLocation: "weights/embeddings.spatial_hcp_lattice.weight"
    });
    const layers = [];
    for (let l = 0; l < numLayers; l++) {
      const qWeight = prng.nextMatrix(embedDim, embedDim, scale);
      const kWeight = prng.nextMatrix(embedDim, embedDim, scale);
      const vWeight = prng.nextMatrix(embedDim, embedDim, scale);
      const outWeight = prng.nextMatrix(embedDim, embedDim, scale);
      const ffn1Weight = prng.nextMatrix(embedDim, embedDim * 2, scale);
      const ffn2Weight = prng.nextMatrix(embedDim * 2, embedDim, scale);
      const norm1Gamma = new Array(embedDim).fill(1);
      const norm2Gamma = new Array(embedDim).fill(1);
      const attnParams = embedDim * embedDim;
      tensorRecords.push({
        tensorName: `layers.${l}.attention.q_proj.weight`,
        shape: [embedDim, embedDim],
        dtype: "float32",
        parameterCount: attnParams,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
        checkpointLocation: `weights/layers.${l}.attention.q_proj.weight`
      });
      tensorRecords.push({
        tensorName: `layers.${l}.attention.k_proj.weight`,
        shape: [embedDim, embedDim],
        dtype: "float32",
        parameterCount: attnParams,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
        checkpointLocation: `weights/layers.${l}.attention.k_proj.weight`
      });
      tensorRecords.push({
        tensorName: `layers.${l}.attention.v_proj.weight`,
        shape: [embedDim, embedDim],
        dtype: "float32",
        parameterCount: attnParams,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
        checkpointLocation: `weights/layers.${l}.attention.v_proj.weight`
      });
      tensorRecords.push({
        tensorName: `layers.${l}.attention.out_proj.weight`,
        shape: [embedDim, embedDim],
        dtype: "float32",
        parameterCount: attnParams,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
        checkpointLocation: `weights/layers.${l}.attention.out_proj.weight`
      });
      const ffn1Params = embedDim * (embedDim * 2);
      tensorRecords.push({
        tensorName: `layers.${l}.mlp.gate_up_proj.weight`,
        shape: [embedDim, embedDim * 2],
        dtype: "float32",
        parameterCount: ffn1Params,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_He",
        checkpointLocation: `weights/layers.${l}.mlp.gate_up_proj.weight`
      });
      const ffn2Params = embedDim * 2 * embedDim;
      tensorRecords.push({
        tensorName: `layers.${l}.mlp.down_proj.weight`,
        shape: [embedDim * 2, embedDim],
        dtype: "float32",
        parameterCount: ffn2Params,
        trainable: true,
        initializationMethod: "DeterministicPRNG(Mulberry32)_He",
        checkpointLocation: `weights/layers.${l}.mlp.down_proj.weight`
      });
      tensorRecords.push({
        tensorName: `layers.${l}.input_layernorm.weight`,
        shape: [embedDim],
        dtype: "float32",
        parameterCount: embedDim,
        trainable: true,
        initializationMethod: "Constant(1.0)",
        checkpointLocation: `weights/layers.${l}.input_layernorm.weight`
      });
      tensorRecords.push({
        tensorName: `layers.${l}.post_attention_layernorm.weight`,
        shape: [embedDim],
        dtype: "float32",
        parameterCount: embedDim,
        trainable: true,
        initializationMethod: "Constant(1.0)",
        checkpointLocation: `weights/layers.${l}.post_attention_layernorm.weight`
      });
      layers.push({
        qWeight,
        kWeight,
        vWeight,
        outWeight,
        ffn1Weight,
        ffn2Weight,
        norm1Gamma,
        norm2Gamma
      });
    }
    const epistemicHead = prng.nextMatrix(embedDim, 7, scale);
    const epistemicParams = embedDim * 7;
    tensorRecords.push({
      tensorName: "head.epistemic_projection.weight",
      shape: [embedDim, 7],
      dtype: "float32",
      parameterCount: epistemicParams,
      trainable: true,
      initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
      checkpointLocation: "weights/head.epistemic_projection.weight"
    });
    const lmHead = prng.nextMatrix(embedDim, vocabSize, scale);
    const lmParams = embedDim * vocabSize;
    tensorRecords.push({
      tensorName: "head.lm_head.weight",
      shape: [embedDim, vocabSize],
      dtype: "float32",
      parameterCount: lmParams,
      trainable: true,
      initializationMethod: "DeterministicPRNG(Mulberry32)_Xavier",
      checkpointLocation: "weights/head.lm_head.weight"
    });
    const totalParams = tensorRecords.reduce((acc, t) => acc + t.parameterCount, 0);
    const inventory = Object.freeze({
      totalParameters: totalParams,
      trainableParameters: totalParams,
      nonTrainableParameters: 0,
      tensors: Object.freeze(tensorRecords),
      accountingVerified: true
    });
    return {
      weights: {
        tokenEmbedding,
        positionalEmbedding,
        spatialEmbedding,
        layers,
        epistemicHead,
        lmHead
      },
      inventory
    };
  }
  getParameterCount() {
    return this.totalParameters;
  }
  getParameterInventory() {
    return this.parameterInventory;
  }
  getWeights() {
    return this.weights;
  }
  setWeights(weights) {
    this.weights = weights;
  }
  /**
   * Computes SHA-256 fingerprint of the current weights
   */
  computeWeightsHash() {
    const hash = (0, import_crypto2.createHash)("sha256");
    const sampleSize = 32;
    for (let i = 0; i < Math.min(sampleSize, this.weights.tokenEmbedding.length); i++) {
      hash.update(Buffer.from(new Float32Array(this.weights.tokenEmbedding[i]).buffer));
    }
    for (let l = 0; l < this.weights.layers.length; l++) {
      hash.update(Buffer.from(new Float32Array(this.weights.layers[l].qWeight[0]).buffer));
      hash.update(Buffer.from(new Float32Array(this.weights.layers[l].ffn1Weight[0]).buffer));
    }
    hash.update(Buffer.from(new Float32Array(this.weights.epistemicHead[0]).buffer));
    hash.update(Buffer.from(new Float32Array(this.weights.lmHead[0]).buffer));
    return hash.digest("hex");
  }
  /**
   * Address 369 Invariant: Maps a 7x7x7 cellId (0..342) to coordinates and address369
   */
  static mapCellIdToSpatialCoordinates(cellId) {
    if (cellId < 0 || cellId > 342) {
      throw new Error(`Cell ID ${cellId} out of range [0..342] for 343-cell lattice`);
    }
    const x = cellId % 7;
    const y = Math.floor(cellId / 7) % 7;
    const z = Math.floor(cellId / 49);
    const address369 = 26 + cellId;
    const digitalRoot = cellId % 9 + 1;
    let harmonicRoot = 9;
    if (digitalRoot <= 3) harmonicRoot = 3;
    else if (digitalRoot <= 6) harmonicRoot = 6;
    else harmonicRoot = 9;
    return { cellId, x, y, z, address369, harmonicRoot };
  }
  /**
   * Address 369 Invariant: Maps coordinates (x,y,z) back to cellId [0..342]
   */
  static mapCoordinatesToCellId(x, y, z) {
    if (x < 0 || x > 6 || y < 0 || y > 6 || z < 0 || z > 6) {
      throw new Error(`Coordinates (${x},${y},${z}) out of range [0..6]^3`);
    }
    return x + y * 7 + z * 49;
  }
  /**
   * Forward pass through CUBIO-NATIVE-MODEL-V1
   */
  forward(inputIds, options = {}) {
    const seqLen = Math.min(inputIds.length, this.config.maxSeqLen);
    const embedDim = this.config.embedDim;
    const vocabSize = this.config.vocabSize;
    const hidden = [];
    for (let t = 0; t < seqLen; t++) {
      const tokenId = Math.min(inputIds[t], vocabSize - 1);
      const tokenVec = this.weights.tokenEmbedding[tokenId];
      const posVec = this.weights.positionalEmbedding[t];
      const vec = new Array(embedDim);
      for (let d = 0; d < embedDim; d++) {
        vec[d] = tokenVec[d] + posVec[d];
      }
      if (options.spatialCellId !== void 0 && options.spatialCellId >= 0 && options.spatialCellId < 343) {
        const spatVec = this.weights.spatialEmbedding[options.spatialCellId];
        for (let d = 0; d < embedDim; d++) {
          vec[d] += spatVec[d] * 0.3;
        }
      }
      hidden.push(vec);
    }
    let currentHidden = hidden;
    const numHeads = this.config.numHeads ?? 8;
    if (embedDim % numHeads !== 0) {
      throw new Error(`embedDim (${embedDim}) must be divisible by numHeads (${numHeads})`);
    }
    const headDim = embedDim / numHeads;
    for (const layer of this.weights.layers) {
      const nextHidden = [];
      const qCache = new Array(seqLen);
      const kCache = new Array(seqLen);
      const vCache = new Array(seqLen);
      for (let t = 0; t < seqLen; t++) {
        const inputVec = currentHidden[t];
        const q = new Array(embedDim).fill(0);
        const k = new Array(embedDim).fill(0);
        const v = new Array(embedDim).fill(0);
        for (let j = 0; j < embedDim; j++) {
          const inJ = inputVec[j];
          const qRow = layer.qWeight[j];
          const kRow = layer.kWeight[j];
          const vRow = layer.vWeight[j];
          for (let i = 0; i < embedDim; i++) {
            q[i] += inJ * qRow[i];
            k[i] += inJ * kRow[i];
            v[i] += inJ * vRow[i];
          }
        }
        qCache[t] = q;
        kCache[t] = k;
        vCache[t] = v;
      }
      for (let t = 0; t < seqLen; t++) {
        const inputVec = currentHidden[t];
        const attnConcat = new Array(embedDim).fill(0);
        for (let h = 0; h < numHeads; h++) {
          const start = h * headDim;
          const end = start + headDim;
          const weights = new Array(t + 1);
          let scoreSum = 0;
          for (let s = 0; s <= t; s++) {
            let dot = 0;
            for (let d = start; d < end; d++) {
              dot += qCache[t][d] * kCache[s][d];
            }
            const w = Math.exp(Math.min(dot / Math.sqrt(headDim), 10));
            weights[s] = w;
            scoreSum += w;
          }
          const invScoreSum = scoreSum > 0 ? 1 / scoreSum : 0;
          for (let s = 0; s <= t; s++) {
            const w = weights[s] * invScoreSum;
            const vS = vCache[s];
            for (let d = start; d < end; d++) {
              attnConcat[d] += w * vS[d];
            }
          }
        }
        const attnOut = new Array(embedDim).fill(0);
        for (let j = 0; j < embedDim; j++) {
          const aJ = attnConcat[j];
          const outRow = layer.outWeight[j];
          for (let i = 0; i < embedDim; i++) {
            attnOut[i] += aJ * outRow[i];
          }
        }
        const midVec = new Array(embedDim);
        const norm1 = layer.norm1Gamma;
        const sum1 = new Array(embedDim);
        let mean1 = 0;
        for (let d = 0; d < embedDim; d++) {
          sum1[d] = inputVec[d] + attnOut[d];
          mean1 += sum1[d];
        }
        mean1 /= embedDim;
        let var1 = 0;
        for (let d = 0; d < embedDim; d++) {
          const diff = sum1[d] - mean1;
          var1 += diff * diff;
        }
        var1 /= embedDim;
        const invStd1 = 1 / Math.sqrt(var1 + 1e-5);
        for (let d = 0; d < embedDim; d++) {
          const xhat1_d = (sum1[d] - mean1) * invStd1;
          midVec[d] = xhat1_d * norm1[d];
        }
        const ffnMid = new Array(embedDim * 2).fill(0);
        for (let j = 0; j < embedDim; j++) {
          const mJ = midVec[j];
          const ffn1Row = layer.ffn1Weight[j];
          for (let i = 0; i < embedDim * 2; i++) {
            ffnMid[i] += mJ * ffn1Row[i];
          }
        }
        for (let i = 0; i < embedDim * 2; i++) {
          if (ffnMid[i] < 0) ffnMid[i] = 0;
        }
        const ffnOut = new Array(embedDim).fill(0);
        for (let j = 0; j < embedDim * 2; j++) {
          const midJ = ffnMid[j];
          const ffn2Row = layer.ffn2Weight[j];
          for (let i = 0; i < embedDim; i++) {
            ffnOut[i] += midJ * ffn2Row[i];
          }
        }
        const layerOut = new Array(embedDim);
        const norm2 = layer.norm2Gamma;
        const sum2 = new Array(embedDim);
        let mean2 = 0;
        for (let d = 0; d < embedDim; d++) {
          sum2[d] = midVec[d] + ffnOut[d];
          mean2 += sum2[d];
        }
        mean2 /= embedDim;
        let var2 = 0;
        for (let d = 0; d < embedDim; d++) {
          const diff = sum2[d] - mean2;
          var2 += diff * diff;
        }
        var2 /= embedDim;
        const invStd2 = 1 / Math.sqrt(var2 + 1e-5);
        for (let d = 0; d < embedDim; d++) {
          const xhat2_d = (sum2[d] - mean2) * invStd2;
          layerOut[d] = xhat2_d * norm2[d];
        }
        nextHidden.push(layerOut);
      }
      currentHidden = nextHidden;
    }
    const logits = [];
    const predictedTokens = [];
    for (let t = 0; t < seqLen; t++) {
      const h = currentHidden[t];
      const tokenLogits = new Array(vocabSize).fill(0);
      for (let d = 0; d < embedDim; d++) {
        const hD = h[d];
        const lmRow = this.weights.lmHead[d];
        for (let v = 0; v < vocabSize; v++) {
          tokenLogits[v] += hD * lmRow[v];
        }
      }
      let maxLogit = -Infinity;
      let argMax = 0;
      for (let v = 0; v < vocabSize; v++) {
        const logit = tokenLogits[v];
        if (logit > maxLogit) {
          maxLogit = logit;
          argMax = v;
        }
      }
      logits.push(tokenLogits);
      predictedTokens.push(argMax);
    }
    const lastH = currentHidden[seqLen - 1];
    const rawEpistemic = new Array(7).fill(0);
    for (let d = 0; d < embedDim; d++) {
      const hD = lastH[d];
      const epiRow = this.weights.epistemicHead[d];
      for (let c = 0; c < 7; c++) {
        rawEpistemic[c] += hD * epiRow[c];
      }
    }
    const maxE = Math.max(...rawEpistemic);
    const expE = rawEpistemic.map((e) => Math.exp(e - maxE));
    const sumExp = expE.reduce((a, b) => a + b, 0);
    const probE = expE.map((e) => sumExp > 0 ? e / sumExp : 1 / 7);
    const epistemicKeys = [
      "FACT" /* FACT */,
      "DERIVATION" /* DERIVATION */,
      "OBSERVATION" /* OBSERVATION */,
      "HYPOTHESIS" /* HYPOTHESIS */,
      "PREDICTION" /* PREDICTION */,
      "ASSUMPTION" /* ASSUMPTION */,
      "UNKNOWN" /* UNKNOWN */
    ];
    const epistemicScores = {};
    let dominantScore = -1;
    let dominantStatus = "DERIVATION" /* DERIVATION */;
    for (let i = 0; i < 7; i++) {
      const status = epistemicKeys[i];
      const score = Math.round(probE[i] * 1e4) / 1e4;
      epistemicScores[status] = score;
      if (score > dominantScore) {
        dominantScore = score;
        dominantStatus = status;
      }
    }
    let isFactAssertionLocked = false;
    if (dominantStatus === "PREDICTION" /* PREDICTION */ || dominantStatus === "HYPOTHESIS" /* HYPOTHESIS */) {
      isFactAssertionLocked = true;
      if (epistemicScores["FACT" /* FACT */] > 0.1) {
        epistemicScores["FACT" /* FACT */] = 0.05;
      }
    }
    return {
      logits,
      epistemicScores,
      predictedTokens,
      dominantEpistemicStatus: dominantStatus,
      isFactAssertionLocked,
      lastHiddenState: options.returnHidden ? currentHidden : []
    };
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_model_loader.ts
var NativeModelLoader = class {
  /**
   * Instantiates a CubiONativeModel from a certified native model checkpoint
   */
  static loadFromCheckpoint(checkpoint, baseConfig) {
    ExternalModelGuard.assertNativeOnly(checkpoint.modelId);
    if (checkpoint.containerType !== "CUBIO_NATIVE_MODEL_CHECKPOINT_V1") {
      throw new Error(`Invalid checkpoint container type: ${checkpoint.containerType}`);
    }
    if (!checkpoint.parameterInventory || !checkpoint.parameterInventory.accountingVerified) {
      throw new Error(`Checkpoint ${checkpoint.checkpointId} failed parameter accounting verification`);
    }
    const model = new CubiONativeModel({
      ...baseConfig,
      modelId: checkpoint.modelId || CUBIO_NATIVE_MODEL_ID
    });
    if (checkpoint.weights) {
      const currentWeights = model.getWeights();
      const reconstructed = {
        tokenEmbedding: checkpoint.weights["tokenEmbedding"] || currentWeights.tokenEmbedding,
        positionalEmbedding: checkpoint.weights["positionalEmbedding"] || currentWeights.positionalEmbedding,
        spatialEmbedding: checkpoint.weights["spatialEmbedding"] || currentWeights.spatialEmbedding,
        layers: checkpoint.weights["layers"] || currentWeights.layers,
        epistemicHead: checkpoint.weights["epistemicHead"] || currentWeights.epistemicHead,
        lmHead: checkpoint.weights["lmHead"] || currentWeights.lmHead
      };
      model.setWeights(reconstructed);
    }
    return model;
  }
  /**
   * Loads a model directly from a checkpoint file path (supports binary and legacy JSON)
   */
  static loadFromFile(filePath, baseConfig) {
    const checkpoint = CheckpointManager.loadCheckpoint(filePath);
    return this.loadFromCheckpoint(checkpoint, baseConfig);
  }
  /**
   * Validates structural integrity of a serialized checkpoint container
   */
  static validateCheckpointIntegrity(checkpoint) {
    if (!checkpoint.checkpointId || !checkpoint.modelId) return false;
    if (checkpoint.containerType !== "CUBIO_NATIVE_MODEL_CHECKPOINT_V1") return false;
    if (!checkpoint.weightsMerkleRoot || !checkpoint.modelStateHash) return false;
    if (!checkpoint.parameterInventory || checkpoint.parameterInventory.totalParameters <= 0) return false;
    return true;
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_vocabulary_v2.ts
var import_crypto3 = require("crypto");
var CUBIO_VOCABULARY_V2_ID = "CUBIO-VOCAB-V2-1024";
var CUBIO_TOKENIZER_V2_ID = "CUBIO-TOKENIZER-V2-1024";
var WORD_BOUNDARY_MARKER = "\u2581";
var NativeVocabularyV2Builder = class {
  static {
    this.SPECIAL_TOKENS = {
      PAD: "<PAD>",
      UNK: "<UNK>",
      BOS: "<BOS>",
      EOS: "<EOS>",
      SEP: "<SEP>",
      MASK: "<MASK>",
      EPISTEMIC_FACT: "<EPISTEMIC_FACT>",
      EPISTEMIC_DERIVATION: "<EPISTEMIC_DERIVATION>",
      EPISTEMIC_OBSERVATION: "<EPISTEMIC_OBSERVATION>",
      EPISTEMIC_HYPOTHESIS: "<EPISTEMIC_HYPOTHESIS>",
      EPISTEMIC_PREDICTION: "<EPISTEMIC_PREDICTION>",
      EPISTEMIC_ASSUMPTION: "<EPISTEMIC_ASSUMPTION>",
      EPISTEMIC_UNKNOWN: "<EPISTEMIC_UNKNOWN>",
      SPATIAL_ANCHOR: "<SPATIAL_ANCHOR>",
      SPATIAL_CELL: "<SPATIAL_CELL>",
      HARMONIC_369: "<HARMONIC_369>"
    };
  }
  static buildVocabulary() {
    const tokenList = [];
    const addedTokens = /* @__PURE__ */ new Set();
    const addToken = (token) => {
      ExternalModelGuard.assertNativeOnly(token);
      if (!addedTokens.has(token) && tokenList.length < 1024) {
        addedTokens.add(token);
        tokenList.push(token);
      }
    };
    const specialTokensMap = {};
    for (const [key, value] of Object.entries(this.SPECIAL_TOKENS)) {
      specialTokensMap[key] = tokenList.length;
      addToken(value);
    }
    for (let c = 32; c <= 126; c++) {
      addToken(String.fromCharCode(c));
    }
    addToken("\n");
    addToken("	");
    addToken("\r");
    const mathSymbols = [
      "+",
      "-",
      "*",
      "/",
      "=",
      "\u2260",
      "\u2248",
      "<",
      ">",
      "\u2264",
      "\u2265",
      "\xB1",
      "\xD7",
      "\xF7",
      "^",
      "\u221A",
      "\u2211",
      "\u220F",
      "\u222B",
      "\u2202",
      "\u2207",
      "\u2208",
      "\u2209",
      "\u2282",
      "\u2286",
      "\u222A",
      "\u2229",
      "\u2227",
      "\u2228",
      "\xAC",
      "\u21D2",
      "\u21D4",
      "\u2200",
      "\u2203",
      "\u221E",
      "\u221D",
      "\u2220",
      "\u03C0",
      "\u03B8",
      "\u03BB",
      "\u03BC",
      "\u03C3",
      "\u03C9",
      "\u0394",
      "\u03A9",
      "c\xB2",
      "E=mc\xB2",
      "mod",
      "%"
    ];
    for (const s of mathSymbols) addToken(s);
    const urduChars = [
      "\u0627",
      "\u0628",
      "\u067E",
      "\u062A",
      "\u0679",
      "\u062B",
      "\u062C",
      "\u0686",
      "\u062D",
      "\u062E",
      "\u062F",
      "\u0688",
      "\u0630",
      "\u0631",
      "\u0691",
      "\u0632",
      "\u0698",
      "\u0633",
      "\u0634",
      "\u0635",
      "\u0636",
      "\u0637",
      "\u0638",
      "\u0639",
      "\u063A",
      "\u0641",
      "\u0642",
      "\u06A9",
      "\u06AF",
      "\u0644",
      "\u0645",
      "\u0646",
      "\u06BA",
      "\u0648",
      "\u06C1",
      "\u06BE",
      "\u0621",
      "\u06CC",
      "\u06D2",
      "\u0626",
      "\u0624",
      "\u06C3",
      "\u06C2",
      "\u06F0",
      "\u06F1",
      "\u06F2",
      "\u06F3",
      "\u06F4",
      "\u06F5",
      "\u06F6",
      "\u06F7",
      "\u06F8",
      "\u06F9",
      "\u061F",
      "\u06D4",
      "\u060C",
      "\u061B"
    ];
    for (const u of urduChars) addToken(u);
    const urduWords = [
      "\u06C1\u06D2",
      "\u06C1\u06CC\u06BA",
      "\u062A\u06BE\u0627",
      "\u062A\u06BE\u06CC",
      "\u062A\u06BE\u06D2",
      "\u06A9\u0627",
      "\u06A9\u06CC",
      "\u06A9\u06D2",
      "\u06A9\u0648",
      "\u0633\u06D2",
      "\u0646\u06D2",
      "\u067E\u0631",
      "\u0645\u06CC\u06BA",
      "\u062A\u06A9",
      "\u0627\u0648\u0631",
      "\u06CC\u0627",
      "\u0627\u06AF\u0631",
      "\u0645\u06AF\u0631",
      "\u0644\u06CC\u06A9\u0646",
      "\u06A9\u06CC\u0648\u0646\u06A9\u06C1",
      "\u067E\u06BE\u0631",
      "\u06A9\u06CC\u0627",
      "\u06A9\u0648\u0646",
      "\u06A9\u06C1\u0627\u06BA",
      "\u06A9\u0628",
      "\u06A9\u06CC\u0648\u06BA",
      "\u06A9\u06CC\u0633\u06D2",
      "\u06CC\u06C1",
      "\u0648\u06C1",
      "\u06C1\u0645",
      "\u0622\u067E",
      "\u062A\u0645",
      "\u0633\u0628",
      "\u06A9\u0648\u0626\u06CC",
      "\u06A9\u0686\u06BE",
      "\u0628\u06C1\u062A",
      "\u06C1\u0627\u06BA",
      "\u0646\u06C1\u06CC\u06BA",
      "\u0645\u0639\u0644\u0648\u0645",
      "\u062D\u0642\u06CC\u0642\u062A"
    ];
    for (const uw of urduWords) addToken(WORD_BOUNDARY_MARKER + uw);
    const romanUrdu = [
      "hai",
      "hain",
      "tha",
      "thi",
      "the",
      "ka",
      "ki",
      "ke",
      "ko",
      "se",
      "ne",
      "par",
      "mein",
      "tak",
      "aur",
      "ya",
      "agar",
      "magar",
      "lekin",
      "kyunke",
      "phir",
      "kya",
      "kaun",
      "kahan",
      "kab",
      "kyun",
      "kaise",
      "yeh",
      "woh",
      "hum",
      "aap",
      "tum",
      "mera",
      "tera",
      "iska",
      "unka",
      "sab",
      "koi",
      "kuch",
      "bohot",
      "zyada",
      "kam",
      "haan",
      "nahi",
      "sahi",
      "galat",
      "maloom",
      "namaloom",
      "shukriya",
      "theek",
      "batao",
      "samjhao",
      "dekho",
      "karo",
      "karoonga",
      "jayega",
      "hoga",
      "hogi",
      "honge",
      "socho"
    ];
    for (const ru of romanUrdu) addToken(WORD_BOUNDARY_MARKER + ru);
    const jsonAndCubio = [
      "{",
      "}",
      "[",
      "]",
      ":",
      ",",
      '"',
      "true",
      "false",
      "null",
      '{"status":',
      '{"action":',
      '{"result":',
      '{"epistemic":',
      '{"address369":',
      '{"nodeId":',
      '{"position":',
      '{"dimension":',
      '{"validated":',
      '{"harmonicRoot":',
      '{"sequenceId":',
      "CUBiO",
      "Address369",
      "343-Cell",
      "HCP",
      "Lattice",
      "Euler",
      "Harmonic",
      "State-T",
      "Costree",
      "Trejetion",
      "Rxiver",
      "Epistemic",
      "FACT",
      "DERIVATION",
      "OBSERVATION",
      "HYPOTHESIS",
      "PREDICTION",
      "ASSUMPTION",
      "UNKNOWN",
      "SpatialMemory",
      "CognitiveSpace",
      "MerkleRoot",
      "Sovereign",
      "Genesis",
      "Checkpoint",
      "Deterministic",
      "Non-Fact",
      "CellId",
      "CoordX",
      "CoordY",
      "CoordZ",
      "NODE_",
      "STATUS_",
      "VERIFIED_STABLE",
      "ACTIVE",
      "INACTIVE",
      "BLOCKED"
    ];
    for (const jt of jsonAndCubio) addToken(jt);
    const coreEnglish = [
      // Articles, pronouns, prepositions, conjunctions
      "the",
      "be",
      "to",
      "of",
      "and",
      "a",
      "in",
      "that",
      "have",
      "I",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
      "this",
      "but",
      "his",
      "by",
      "from",
      "they",
      "we",
      "say",
      "her",
      "she",
      "or",
      "an",
      "will",
      "my",
      "one",
      "all",
      "would",
      "there",
      "their",
      "what",
      "so",
      "up",
      "out",
      "if",
      "about",
      "who",
      "get",
      "which",
      "go",
      "me",
      "when",
      "make",
      "can",
      "like",
      "time",
      "no",
      "just",
      "him",
      "know",
      "take",
      "people",
      "into",
      "year",
      "your",
      "good",
      "some",
      "could",
      "them",
      "see",
      "other",
      "than",
      "then",
      "now",
      "look",
      "only",
      "come",
      "its",
      "over",
      "think",
      "also",
      "back",
      "after",
      "use",
      "two",
      "how",
      "our",
      "work",
      "first",
      "well",
      "way",
      "even",
      "new",
      "want",
      "because",
      "any",
      "these",
      "give",
      "day",
      "most",
      "us",
      // Conversational verbs & adjectives
      "hello",
      "greetings",
      "please",
      "thank",
      "thanks",
      "welcome",
      "yes",
      "correct",
      "certain",
      "clear",
      "help",
      "assist",
      "explain",
      "describe",
      "state",
      "clarify",
      "understand",
      "answer",
      "respond",
      "question",
      "query",
      "ready",
      "operating",
      "running",
      "initialized",
      "online",
      "available",
      "stable",
      "current",
      "complete",
      "completed",
      "active",
      "functional",
      "verified",
      "confirmed",
      "ensured",
      // Epistemic calibration vocabulary
      "fact",
      "facts",
      "factual",
      "empirical",
      "proven",
      "observed",
      "observation",
      "observations",
      "derive",
      "derivation",
      "derived",
      "deduced",
      "calculated",
      "computed",
      "inferred",
      "hypothesis",
      "hypothetical",
      "theorize",
      "unproven",
      "conjecture",
      "premise",
      "predict",
      "prediction",
      "predictive",
      "forecast",
      "speculation",
      "future",
      "estimate",
      "assume",
      "assumption",
      "assumed",
      "supposition",
      "unknown",
      "uncertain",
      "uncertainty",
      "indeterminate",
      "unverified",
      "undecided",
      "evidence",
      "grounded",
      "source",
      "proof",
      "absolute",
      "provisional",
      "tentative",
      // Technical, spatial, cognitive concepts
      "system",
      "model",
      "memory",
      "state",
      "process",
      "spatial",
      "dimension",
      "coordinate",
      "energy",
      "mass",
      "lattice",
      "physics",
      "tensor",
      "neural",
      "vector",
      "matrix",
      "weight",
      "weights",
      "layer",
      "layers",
      "attention",
      "head",
      "heads",
      "sequence",
      "length",
      "token",
      "tokens",
      "embedding",
      "gradient",
      "loss",
      "step",
      "epoch",
      "learning",
      "rate",
      "decay",
      "adamw",
      "optimization",
      "backpropagation",
      "forward",
      "logits",
      "softmax",
      "cross",
      "entropy",
      "accuracy",
      "perplexity",
      "cell",
      "cells",
      "cluster",
      "partition",
      "manifest",
      "hash",
      "sha256",
      "checksum",
      "merkle",
      "tree",
      "root",
      "digital",
      "modulo",
      "vortex",
      "harmonic",
      "resonance",
      "frequency",
      "octave",
      "topology",
      "graph",
      "node",
      "nodes",
      "edge",
      "edges",
      "link",
      "links",
      "route",
      "routing",
      "origin",
      "transit",
      "target",
      "destination",
      "migration",
      "trajectory",
      "snapshot",
      "store",
      "recall",
      "retrieve",
      "lookup",
      "index",
      "key",
      "value",
      "pair",
      "schema",
      "entity",
      "entities",
      // Safety, sovereignty, boundary terms
      "hardware",
      "actuation",
      "physical",
      "blocked",
      "disabled",
      "lockout",
      "lock",
      "permanent",
      "isolated",
      "offline",
      "external",
      "foreign",
      "sovereign",
      "custody",
      "immutable",
      "sealed",
      "invariant",
      "protection",
      "guard",
      "security",
      "boundary",
      "safety",
      "fail",
      "closed",
      "divergence",
      "regression",
      "forgetting",
      "catastrophic",
      "finite",
      "numerical",
      "valid",
      // Expanded communication vocabulary
      "always",
      "never",
      "sometimes",
      "often",
      "rarely",
      "perhaps",
      "maybe",
      "likely",
      "unlikely",
      "possible",
      "impossible",
      "necessary",
      "sufficient",
      "exact",
      "approximately",
      "roughly",
      "precisely",
      "strictly",
      "completely",
      "partially",
      "directly",
      "indirectly",
      "naturally",
      "clearly",
      "truly",
      "simply",
      "specifically",
      "generally",
      "primarily",
      "secondarily",
      "furthermore",
      "moreover",
      "however",
      "nevertheless",
      "consequently",
      "therefore",
      "thus",
      "although",
      "whereas",
      "meanwhile",
      "instead",
      "otherwise",
      "regardless",
      "namely",
      "detail",
      "details",
      "summary",
      "overview",
      "report",
      "analysis",
      "finding",
      "findings",
      "strength",
      "strengths",
      "limitation",
      "limitations",
      "bottleneck",
      "improvement",
      "curriculum",
      "dataset",
      "training",
      "validation",
      "evaluation",
      "benchmark",
      "testing",
      "score",
      "scores",
      "metric",
      "metrics",
      "rate",
      "delta",
      "before",
      "after",
      "comparison",
      "baseline",
      "candidate",
      "production",
      "service",
      "runtime",
      "interface",
      "protocol",
      "architecture",
      "foundation",
      "cognitive",
      "symbolic",
      "discrete",
      "continuous",
      "representation",
      "superposition",
      "entanglement",
      "coherence",
      "quantum",
      "space",
      "three",
      "dimensional",
      "cubic",
      "hexagonal",
      "closest",
      "packing",
      "sphere",
      "point",
      "center",
      "radius",
      "volume",
      "distance",
      "metric",
      "interval",
      "period",
      "cycle",
      "iteration",
      "duration",
      "latency",
      "milliseconds",
      "seconds",
      "throughput",
      "bandwidth",
      "memory",
      "storage",
      "disk",
      "ram",
      "bytes",
      "megabytes",
      "gigabytes",
      "registers",
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "hundred",
      "thousand",
      "million",
      "billion",
      "first",
      "second",
      "third",
      "fourth",
      "fifth",
      "sixth",
      "seventh",
      "eighth",
      "ninth",
      "tenth",
      "final",
      "initial",
      "previous",
      "following",
      "subsequent",
      "intermediate",
      "terminal",
      "starting",
      "ending",
      "checkpointed",
      "registered",
      "allocated",
      "deallocated",
      "created",
      "updated",
      "deleted",
      "queried",
      "matched",
      "found",
      "missing",
      "failed",
      "succeeded",
      "passed",
      "tested",
      "audited",
      "inspected",
      "governed",
      "authorized",
      "rejected",
      "permitted",
      "prohibited",
      // Extremely common words previously missing entirely from the vocabulary
      "is",
      "are",
      "was",
      "were",
      "been",
      "being",
      "has",
      "had",
      "those",
      "where"
    ];
    for (const ew of coreEnglish) addToken(WORD_BOUNDARY_MARKER + ew);
    const suffixPieces = [
      "ing",
      "ed",
      "ly",
      "tion",
      "ment",
      "ness",
      "able",
      "ible",
      "ity",
      "ful",
      "less",
      "ous",
      "est",
      "er",
      "al",
      "ic",
      "ive",
      "ize"
    ];
    for (const sp of suffixPieces) addToken(sp);
    const statusLabels = [
      "Confirmed: ",
      "Operating: ",
      "Status: ",
      "Observation: ",
      "Hypothesis: ",
      "Prediction: "
    ];
    for (const sl of statusLabels) addToken(sl);
    const extraCommonWords = [
      "world",
      "today",
      "tomorrow",
      "yesterday",
      "name",
      "great",
      "nice",
      "sorry",
      "morning",
      "evening",
      "night",
      "water",
      "food",
      "home",
      "friend",
      "family",
      "love",
      "happy",
      "sad",
      "small",
      "big",
      "long",
      "short",
      "true",
      "start",
      "stop",
      "open",
      "close",
      "left",
      "right",
      "top",
      "bottom",
      "inside",
      "outside",
      "during",
      "again",
      "still",
      "yet",
      "already",
      "soon",
      "later",
      "every",
      "each",
      "own",
      "same",
      "different",
      "important",
      "difficult",
      "easy",
      "talk",
      "speak",
      "read",
      "write",
      "learn",
      "teach",
      "play",
      "walk",
      "run",
      "eat",
      "drink",
      "sleep",
      "wake",
      "live",
      "die",
      "born",
      "grow",
      "change",
      "start",
      "end",
      "begin",
      "finish",
      "try",
      "need",
      "must",
      "should",
      "may",
      "might",
      "shall",
      "let",
      "keep",
      "put",
      "set",
      "show",
      "tell",
      "ask",
      "call",
      "feel",
      "seem",
      "turn",
      "move",
      "hold",
      "bring",
      "send",
      "meet"
    ];
    for (const cw of extraCommonWords) addToken(WORD_BOUNDARY_MARKER + cw);
    addToken(WORD_BOUNDARY_MARKER);
    let idx = 0;
    while (tokenList.length < 1024) {
      const padToken = `_T${idx.toString().padStart(4, "0")}_`;
      addToken(padToken);
      idx++;
    }
    const tokenToId = /* @__PURE__ */ new Map();
    const idToToken = /* @__PURE__ */ new Map();
    for (let i = 0; i < tokenList.length; i++) {
      tokenToId.set(tokenList[i], i);
      idToToken.set(i, tokenList[i]);
    }
    const vocabPayload = JSON.stringify(tokenList);
    const vocabularyHash = (0, import_crypto3.createHash)("sha256").update(vocabPayload).digest("hex");
    return Object.freeze({
      vocabularyId: CUBIO_VOCABULARY_V2_ID,
      tokenizerId: CUBIO_TOKENIZER_V2_ID,
      size: tokenList.length,
      tokenToId,
      idToToken,
      vocabularyHash,
      specialTokens: Object.freeze(specialTokensMap)
    });
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_tokenizer.ts
var NativeTokenizer = class {
  constructor(vocabCatalog) {
    this.tokenizerId = CUBIO_TOKENIZER_V2_ID;
    this.vocabularyId = CUBIO_VOCABULARY_V2_ID;
    this.vocab = vocabCatalog ?? NativeVocabularyV2Builder.buildVocabulary();
    ExternalModelGuard.assertNativeOnly(this.tokenizerId);
    ExternalModelGuard.assertNativeOnly(this.vocabularyId);
    this.sortedVocabKeys = Array.from(this.vocab.tokenToId.keys()).sort(
      (a, b) => b.length - a.length
    );
    let maxLen = 1;
    for (const key of this.sortedVocabKeys) {
      if (key.length > maxLen) maxLen = key.length;
    }
    this.maxSubwordLen = maxLen;
  }
  getTokenizerId() {
    return this.tokenizerId;
  }
  getVocabSize() {
    return this.vocab.size;
  }
  getVocabularyHash() {
    return this.vocab.vocabularyHash;
  }
  getSpecialTokenId(tokenName) {
    const val = NativeVocabularyV2Builder.SPECIAL_TOKENS[tokenName];
    return this.vocab.tokenToId.get(val) ?? 1;
  }
  /**
   * Tokenizes an input string into token pieces using longest-prefix greedy matching.
   *
   * Literal spaces are first converted into WORD_BOUNDARY_MARKER so that
   * word-initial vocab entries (which are stored as marker+word) match
   * directly. This guarantees correct spacing on decode regardless of which
   * individual subword pieces the model predicts — the space is part of the
   * token identity, not a separate token the model has to remember to emit.
   */
  tokenize(text) {
    if (!text || text.length === 0) return [];
    const normalized = text.split(" ").join(WORD_BOUNDARY_MARKER);
    const pieces = [];
    let i = 0;
    const len = normalized.length;
    while (i < len) {
      let matched = false;
      const endLimit = Math.min(len, i + this.maxSubwordLen);
      for (let j = endLimit; j > i; j--) {
        const substr = normalized.substring(i, j);
        if (this.vocab.tokenToId.has(substr)) {
          pieces.push(substr);
          i = j;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const char = normalized[i];
        if (this.vocab.tokenToId.has(char)) {
          pieces.push(char);
        } else {
          pieces.push(NativeVocabularyV2Builder.SPECIAL_TOKENS.UNK);
        }
        i++;
      }
    }
    return pieces;
  }
  /**
   * Encodes a string into an array of token IDs.
   */
  encode(text, options = {}) {
    const { addSpecialTokens = false, maxSeqLen, padToMaxLen = false } = options;
    const tokens = [];
    if (addSpecialTokens) {
      tokens.push(this.getSpecialTokenId("BOS"));
    }
    const pieces = this.tokenize(text);
    for (const p of pieces) {
      const id = this.vocab.tokenToId.get(p) ?? this.getSpecialTokenId("UNK");
      tokens.push(id);
    }
    if (addSpecialTokens) {
      tokens.push(this.getSpecialTokenId("EOS"));
    }
    let finalTokens = tokens;
    if (maxSeqLen && finalTokens.length > maxSeqLen) {
      finalTokens = finalTokens.slice(0, maxSeqLen);
      if (addSpecialTokens && maxSeqLen > 1) {
        finalTokens[maxSeqLen - 1] = this.getSpecialTokenId("EOS");
      }
    }
    if (padToMaxLen && maxSeqLen && finalTokens.length < maxSeqLen) {
      const padId = this.getSpecialTokenId("PAD");
      while (finalTokens.length < maxSeqLen) {
        finalTokens.push(padId);
      }
    }
    return finalTokens;
  }
  /**
   * Decodes an array of token IDs back into text.
   *
   * A piece that starts with WORD_BOUNDARY_MARKER is a word boundary: the
   * marker becomes a real space and the rest of the piece follows it. A
   * piece without the marker (a suffix like "ing", or punctuation) attaches
   * directly to whatever came before it, with no space.
   */
  decode(tokens, options = {}) {
    const { skipSpecialTokens = false } = options;
    const specialValues = new Set(Object.values(NativeVocabularyV2Builder.SPECIAL_TOKENS));
    let result = "";
    for (const id of tokens) {
      const piece = this.vocab.idToToken.get(id);
      if (!piece) continue;
      if (skipSpecialTokens && specialValues.has(piece)) {
        continue;
      }
      if (piece.startsWith(WORD_BOUNDARY_MARKER)) {
        result += " " + piece.slice(WORD_BOUNDARY_MARKER.length);
      } else {
        result += piece;
      }
    }
    return result;
  }
  /**
   * Encodes text into tensor-compatible batch structure with attention masks
   */
  batchEncode(texts, maxSeqLen = 128) {
    const inputIds = [];
    const attentionMask = [];
    for (const text of texts) {
      const ids = this.encode(text, { addSpecialTokens: true, maxSeqLen, padToMaxLen: true });
      const padId = this.getSpecialTokenId("PAD");
      const mask = ids.map((id) => id === padId ? 0 : 1);
      inputIds.push(ids);
      attentionMask.push(mask);
    }
    return { inputIds, attentionMask };
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/deterministic_arithmetic_router.ts
var DeterministicArithmeticRouter = class {
  /**
   * Attempts to detect and solve an arithmetic or comparison query deterministically.
   * Returns ArithmeticResolution with isMatch=true and responseText if solved,
   * or isMatch=false if the prompt should fall back to standard LLM generation.
   */
  static resolve(prompt) {
    const text = prompt.trim();
    const compWordMatch = text.match(
      /([A-Z][a-z]+)\s+has\s+(\d+)\s+([a-z]+)\s+and\s+([A-Z][a-z]+)\s+has\s+(\d+)(?:\s+[a-z]+)?,\s*who\s+has\s+(more|fewer|less)\??/i
    );
    if (compWordMatch) {
      const name1 = compWordMatch[1];
      const a = parseInt(compWordMatch[2], 10);
      const item = compWordMatch[3];
      const name2 = compWordMatch[4];
      const b = parseInt(compWordMatch[5], 10);
      const queryType = compWordMatch[6].toLowerCase();
      let responseText = "";
      let winner = "";
      if (queryType === "more") {
        if (a > b) {
          winner = name1;
          responseText = `${name1} has more with ${a} ${item} compared to ${name2}'s ${b}.`;
        } else if (b > a) {
          winner = name2;
          responseText = `${name2} has more with ${b} ${item} compared to ${name1}'s ${a}.`;
        } else {
          winner = "EQUAL";
          responseText = `Both ${name1} and ${name2} have an equal amount of ${a} ${item}.`;
        }
      } else {
        if (a < b) {
          winner = name1;
          responseText = `${name1} has fewer with ${a} ${item} compared to ${name2}'s ${b}.`;
        } else if (b < a) {
          winner = name2;
          responseText = `${name2} has fewer with ${b} ${item} compared to ${name1}'s ${a}.`;
        } else {
          winner = "EQUAL";
          responseText = `Both ${name1} and ${name2} have an equal amount of ${a} ${item}.`;
        }
      }
      return {
        isMatch: true,
        operation: "COMPARISON",
        operandA: a,
        operandB: b,
        result: winner,
        itemNoun: item,
        responseText,
        matchedPattern: "COMPARISON_WORD_WHO_HAS"
      };
    }
    const compWhichMatch = text.match(
      /(?:which\s+(?:number\s+)?is\s+(bigger|greater|larger|more|smaller|less),\s*(\d+)\s+or\s+(\d+)|between\s+(\d+)\s+and\s+(\d+),\s*which\s+is\s+(bigger|greater|larger|more|smaller|less))/i
    );
    if (compWhichMatch) {
      const compWord = (compWhichMatch[1] || compWhichMatch[6]).toLowerCase();
      const a = parseInt(compWhichMatch[2] || compWhichMatch[4], 10);
      const b = parseInt(compWhichMatch[3] || compWhichMatch[5], 10);
      const isSeekingGreater = ["bigger", "greater", "larger", "more"].includes(compWord);
      let responseText = "";
      let chosen;
      if (a === b) {
        chosen = a;
        responseText = `${a} and ${b} are equal.`;
      } else if (isSeekingGreater) {
        chosen = a > b ? a : b;
        responseText = `${chosen} is greater.`;
      } else {
        chosen = a < b ? a : b;
        responseText = `${chosen} is smaller.`;
      }
      return {
        isMatch: true,
        operation: "COMPARISON",
        operandA: a,
        operandB: b,
        result: chosen,
        responseText,
        matchedPattern: "COMPARISON_WHICH_IS"
      };
    }
    const compIsGreaterMatch = text.match(
      /is\s+(\d+)\s+(greater|more|bigger|larger)\s+than\s+(\d+)/i
    );
    if (compIsGreaterMatch) {
      const a = parseInt(compIsGreaterMatch[1], 10);
      const b = parseInt(compIsGreaterMatch[3], 10);
      const isGreater = a > b;
      const responseText = isGreater ? `Yes, ${a} is greater than ${b}.` : a === b ? `No, ${a} and ${b} are equal.` : `No, ${a} is not greater than ${b}.`;
      return {
        isMatch: true,
        operation: "COMPARISON",
        operandA: a,
        operandB: b,
        result: isGreater,
        responseText,
        matchedPattern: "COMPARISON_IS_GREATER"
      };
    }
    const compIsLessMatch = text.match(
      /is\s+(\d+)\s+(less|smaller)\s+than\s+(\d+)/i
    );
    if (compIsLessMatch) {
      const a = parseInt(compIsLessMatch[1], 10);
      const b = parseInt(compIsLessMatch[3], 10);
      const isLess = a < b;
      const responseText = isLess ? `Yes, ${a} is smaller than ${b}.` : a === b ? `No, ${a} and ${b} are equal.` : `No, ${a} is not smaller than ${b}.`;
      return {
        isMatch: true,
        operation: "COMPARISON",
        operandA: a,
        operandB: b,
        result: isLess,
        responseText,
        matchedPattern: "COMPARISON_IS_LESS"
      };
    }
    const divWordMatch = text.match(
      /([A-Z][a-z]+)\s+has\s+(\d+)\s+([a-z]+)\s+to share equally among\s+(\d+)\s+([a-z]+)/i
    );
    if (divWordMatch) {
      const entity = divWordMatch[1];
      const a = parseInt(divWordMatch[2], 10);
      const item = divWordMatch[3];
      const b = parseInt(divWordMatch[4], 10);
      const groupNoun = divWordMatch[5];
      if (b === 0) {
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: 0,
          result: "UNDEFINED",
          responseText: "Division by zero is undefined.",
          matchedPattern: "DIVISION_BY_ZERO_WORD"
        };
      }
      if (a % b === 0) {
        const quotient = a / b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: quotient,
          itemNoun: item,
          entityName: entity,
          responseText: `Each ${groupNoun.replace(/s$/, "")} receives ${quotient} ${item}.`,
          matchedPattern: "DIVISION_WORD_CLEAN"
        };
      } else {
        const quotient = Math.floor(a / b);
        const remainder = a % b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: `${quotient} R${remainder}`,
          itemNoun: item,
          entityName: entity,
          responseText: `Each ${groupNoun.replace(/s$/, "")} receives ${quotient} ${item} with a remainder of ${remainder}.`,
          matchedPattern: "DIVISION_WORD_REMAINDER"
        };
      }
    }
    const divIfSharedMatch = text.match(
      /if\s+(\d+)\s+([a-z]+)\s+are shared equally (?:among|between)\s+(\d+)\s+([a-z]+)/i
    );
    if (divIfSharedMatch) {
      const a = parseInt(divIfSharedMatch[1], 10);
      const item = divIfSharedMatch[2];
      const b = parseInt(divIfSharedMatch[3], 10);
      const groupNoun = divIfSharedMatch[4];
      if (b === 0) {
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: 0,
          result: "UNDEFINED",
          responseText: "Division by zero is undefined.",
          matchedPattern: "DIVISION_BY_ZERO_WORD"
        };
      }
      if (a % b === 0) {
        const quotient = a / b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: quotient,
          itemNoun: item,
          responseText: `Each ${groupNoun.replace(/s$/, "")} gets ${quotient} ${item}.`,
          matchedPattern: "DIVISION_IF_SHARED_CLEAN"
        };
      } else {
        const quotient = Math.floor(a / b);
        const remainder = a % b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: `${quotient} R${remainder}`,
          itemNoun: item,
          responseText: `Each ${groupNoun.replace(/s$/, "")} gets ${quotient} ${item} with a remainder of ${remainder}.`,
          matchedPattern: "DIVISION_IF_SHARED_REMAINDER"
        };
      }
    }
    const divDirectMatch = text.match(
      /(?:what is|calculate|compute|can you calculate|eval(?:uate)?)?\s*(?:divide\s+)?(\d+)\s*(?:divided by|\/|by)\s*(\d+)/i
    );
    if (divDirectMatch && (text.toLowerCase().includes("divid") || text.includes("/"))) {
      const a = parseInt(divDirectMatch[1], 10);
      const b = parseInt(divDirectMatch[2], 10);
      if (b === 0) {
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: 0,
          result: "UNDEFINED",
          responseText: "Division by zero is undefined.",
          matchedPattern: "DIRECT_DIVIDE_BY_ZERO"
        };
      }
      if (a % b === 0) {
        const quotient = a / b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: quotient,
          responseText: `The computed quotient is ${quotient}.`,
          matchedPattern: "DIRECT_DIVIDE_CLEAN"
        };
      } else {
        const decimalVal = parseFloat((a / b).toFixed(2));
        const intQuot = Math.floor(a / b);
        const rem = a % b;
        return {
          isMatch: true,
          operation: "DIVISION",
          operandA: a,
          operandB: b,
          result: decimalVal,
          responseText: `The computed quotient is ${decimalVal} (${intQuot} with a remainder of ${rem}).`,
          matchedPattern: "DIRECT_DIVIDE_DECIMAL"
        };
      }
    }
    const multWordBoxesMatch = text.match(
      /([A-Z][a-z]+)\s+has\s+(\d+)\s+([a-z]+)\s+with\s+(\d+)\s+([a-z]+)\s+each(?:,)?\s*how many\s+[a-z]+\s+(?:in\s+)?total/i
    );
    if (multWordBoxesMatch) {
      const entity = multWordBoxesMatch[1];
      const a = parseInt(multWordBoxesMatch[2], 10);
      const containerNoun = multWordBoxesMatch[3];
      const b = parseInt(multWordBoxesMatch[4], 10);
      const item = multWordBoxesMatch[5];
      const product = a * b;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: a,
        operandB: b,
        result: product,
        entityName: entity,
        itemNoun: item,
        responseText: `The total count for ${entity} is ${product} ${item}.`,
        matchedPattern: "MULT_WORD_BOXES"
      };
    }
    const multWordCostMatch = text.match(
      /if each\s+([a-z]+)\s+costs\s+(\d+)\s+and\s+(?:you|someone|\w+)\s+buys?\s+(\d+)/i
    );
    if (multWordCostMatch) {
      const item = multWordCostMatch[1];
      const unitCost = parseInt(multWordCostMatch[2], 10);
      const qty = parseInt(multWordCostMatch[3], 10);
      const totalCost = unitCost * qty;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: unitCost,
        operandB: qty,
        result: totalCost,
        itemNoun: item,
        responseText: `The total cost is ${totalCost}.`,
        matchedPattern: "MULT_WORD_COST"
      };
    }
    const multMultiplyMatch = text.match(/multiply\s+(\d+)\s+(?:and|by)\s+(\d+)/i);
    if (multMultiplyMatch) {
      const a = parseInt(multMultiplyMatch[1], 10);
      const b = parseInt(multMultiplyMatch[2], 10);
      const product = a * b;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: a,
        operandB: b,
        result: product,
        responseText: `The computed product is ${product}.`,
        matchedPattern: "DIRECT_MULTIPLY_BY"
      };
    }
    const multTimesMatch = text.match(
      /(?:what is|calculate|compute|can you calculate)?\s*(\d+)\s*times\s*(\d+)/i
    );
    if (multTimesMatch) {
      const a = parseInt(multTimesMatch[1], 10);
      const b = parseInt(multTimesMatch[2], 10);
      const product = a * b;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: a,
        operandB: b,
        result: product,
        responseText: `The computed product is ${product}.`,
        matchedPattern: "DIRECT_TIMES"
      };
    }
    const multSymbolMatch = text.match(
      /(?:what is|calculate|compute|find the value of)?\s*(\d+)\s*(?:\*|x|multiplied by)\s*(\d+)/i
    );
    if (multSymbolMatch) {
      const a = parseInt(multSymbolMatch[1], 10);
      const b = parseInt(multSymbolMatch[2], 10);
      const product = a * b;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: a,
        operandB: b,
        result: product,
        responseText: `The computed product is ${product}.`,
        matchedPattern: "DIRECT_MULTIPLIED_BY"
      };
    }
    const multProductMatch = text.match(
      /(?:find|what is|calculate)\s+the product of\s+(\d+)\s+and\s+(\d+)/i
    );
    if (multProductMatch) {
      const a = parseInt(multProductMatch[1], 10);
      const b = parseInt(multProductMatch[2], 10);
      const product = a * b;
      return {
        isMatch: true,
        operation: "MULTIPLICATION",
        operandA: a,
        operandB: b,
        result: product,
        responseText: `The product of ${a} and ${b} is ${product}.`,
        matchedPattern: "DIRECT_PRODUCT_OF"
      };
    }
    const wordSubStoreMatch = text.match(
      /a store had\s+(\d+)\s+([a-z]+)\s+on the shelf\.\s*Customers purchased\s+(\d+)/i
    );
    if (wordSubStoreMatch) {
      const a = parseInt(wordSubStoreMatch[1], 10);
      const item = wordSubStoreMatch[2];
      const b = parseInt(wordSubStoreMatch[3], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        itemNoun: item,
        responseText: `There are ${diff} ${item} left on the shelf.`,
        matchedPattern: "WORD_SUB_STORE"
      };
    }
    const wordSubProjectMatch = text.match(
      /([A-Z][a-z]+)\s+had\s+(\d+)\s+([a-z]+)\s+and used\s+(\d+)/i
    );
    if (wordSubProjectMatch) {
      const entity = wordSubProjectMatch[1];
      const a = parseInt(wordSubProjectMatch[2], 10);
      const item = wordSubProjectMatch[3];
      const b = parseInt(wordSubProjectMatch[4], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        entityName: entity,
        itemNoun: item,
        responseText: `The remaining balance is ${diff} ${item}.`,
        matchedPattern: "WORD_SUB_PROJECT"
      };
    }
    const wordSubGiveAwayMatch = text.match(
      /if I have\s+(\d+)\s+([a-z]+)\s+and give away\s+(\d+)/i
    );
    if (wordSubGiveAwayMatch) {
      const a = parseInt(wordSubGiveAwayMatch[1], 10);
      const item = wordSubGiveAwayMatch[2];
      const b = parseInt(wordSubGiveAwayMatch[3], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        itemNoun: item,
        responseText: `Subtracting gives ${diff} ${item} left.`,
        matchedPattern: "WORD_SUB_GIVE_AWAY"
      };
    }
    const diffBetweenMatch = text.match(
      /(?:what is\s+)?the difference between\s+(\d+)\s+and\s+(\d+)/i
    );
    if (diffBetweenMatch) {
      const a = parseInt(diffBetweenMatch[1], 10);
      const b = parseInt(diffBetweenMatch[2], 10);
      const diff = Math.abs(a - b);
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        responseText: `The difference between ${a} and ${b} is ${diff}.`,
        matchedPattern: "DIRECT_DIFF_BETWEEN"
      };
    }
    const subFromMatch = text.match(/subtract(?:ing)?\s+(\d+)\s+from\s+(\d+)/i);
    if (subFromMatch) {
      const b = parseInt(subFromMatch[1], 10);
      const a = parseInt(subFromMatch[2], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        responseText: `The result is exactly ${diff}.`,
        matchedPattern: "DIRECT_SUBTRACT_FROM"
      };
    }
    const takeAwayMatch = text.match(/take\s+(\d+)\s+away\s+from\s+(\d+)/i);
    if (takeAwayMatch) {
      const b = parseInt(takeAwayMatch[1], 10);
      const a = parseInt(takeAwayMatch[2], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        responseText: `The remaining balance is ${diff}.`,
        matchedPattern: "DIRECT_TAKE_AWAY_FROM"
      };
    }
    const minusMatch = text.match(
      /(?:what is|calculate|can you calculate|what does|find the value of)?\s*(\d+)\s*(?:minus|-)\s*(\d+)(?:\s*equal(?:\s*to)?)?/i
    );
    if (minusMatch) {
      const a = parseInt(minusMatch[1], 10);
      const b = parseInt(minusMatch[2], 10);
      const diff = a - b;
      return {
        isMatch: true,
        operation: "SUBTRACTION",
        operandA: a,
        operandB: b,
        result: diff,
        responseText: `The computed difference is ${diff}.`,
        matchedPattern: "DIRECT_MINUS"
      };
    }
    const wordAddCollectMatch = text.match(
      /([A-Z][a-z]+)\s+collected\s+(\d+)\s+([a-z]+)\s+in the morning and found\s+(\d+)\s+more/i
    );
    if (wordAddCollectMatch) {
      const entity = wordAddCollectMatch[1];
      const a = parseInt(wordAddCollectMatch[2], 10);
      const item = wordAddCollectMatch[3];
      const b = parseInt(wordAddCollectMatch[4], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        entityName: entity,
        itemNoun: item,
        responseText: `The combined sum for ${entity} is ${sum} ${item}.`,
        matchedPattern: "WORD_ADD_COLLECTED"
      };
    }
    const wordAddBuyMatch = text.match(
      /if I have\s+(\d+)\s+([a-z]+)\s+and buy\s+(\d+)\s+more/i
    );
    if (wordAddBuyMatch) {
      const a = parseInt(wordAddBuyMatch[1], 10);
      const item = wordAddBuyMatch[2];
      const b = parseInt(wordAddBuyMatch[3], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        itemNoun: item,
        responseText: `Adding the two amounts yields ${sum} ${item}.`,
        matchedPattern: "WORD_ADD_BUY"
      };
    }
    const plusMatch = text.match(
      /(?:what is|compute|calculate|can you calculate|eval(?:uate)?|find the value of)?\s*(\d+)\s*(?:plus|\+)\s*(\d+)/i
    );
    if (plusMatch) {
      const a = parseInt(plusMatch[1], 10);
      const b = parseInt(plusMatch[2], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        responseText: `The computed sum is ${sum}.`,
        matchedPattern: "DIRECT_PLUS"
      };
    }
    const addAndMatch = text.match(
      /(?:please\s+)?add\s+(\d+)\s+and\s+(\d+)(?:\s+together)?/i
    );
    if (addAndMatch) {
      const a = parseInt(addAndMatch[1], 10);
      const b = parseInt(addAndMatch[2], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        responseText: `Adding ${a} and ${b} yields ${sum}.`,
        matchedPattern: "DIRECT_ADD_AND"
      };
    }
    const totalOfMatch = text.match(
      /what is the (?:total|sum) of\s+(\d+)\s+and\s+(\d+)/i
    );
    if (totalOfMatch) {
      const a = parseInt(totalOfMatch[1], 10);
      const b = parseInt(totalOfMatch[2], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        responseText: `The total comes out to ${sum}.`,
        matchedPattern: "DIRECT_TOTAL_OF"
      };
    }
    const addingToMatch = text.match(/adding\s+(\d+)\s+to\s+(\d+)/i);
    if (addingToMatch) {
      const a = parseInt(addingToMatch[1], 10);
      const b = parseInt(addingToMatch[2], 10);
      const sum = a + b;
      return {
        isMatch: true,
        operation: "ADDITION",
        operandA: a,
        operandB: b,
        result: sum,
        responseText: `The total comes out to ${sum}.`,
        matchedPattern: "DIRECT_ADDING_TO"
      };
    }
    return {
      isMatch: false
    };
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_wasm_forward.ts
function leb(n) {
  const b = [];
  do {
    let x = n & 127;
    n >>>= 7;
    if (n !== 0) x |= 128;
    b.push(x);
  } while (n !== 0);
  return b;
}
function sleb(n) {
  const b = [];
  let more = true;
  while (more) {
    let byte = n & 127;
    n >>= 7;
    if (n === 0 && (byte & 64) === 0 || n === -1 && (byte & 64) !== 0) {
      more = false;
    } else {
      byte |= 128;
    }
    b.push(byte);
  }
  return b;
}
function sec(id, payload) {
  return [id, ...leb(payload.length), ...payload];
}
var WasmBuilder = class {
  constructor() {
    this.bytes = [];
  }
  emit(...b) {
    this.bytes.push(...b);
  }
  i32Const(val) {
    this.emit(65, ...sleb(val));
  }
  localGet(idx) {
    this.emit(32, ...leb(idx));
  }
  localSet(idx) {
    this.emit(33, ...leb(idx));
  }
  i32Add() {
    this.emit(106);
  }
  i32Mul() {
    this.emit(108);
  }
  i32Shl() {
    this.emit(116);
  }
  i32GeS() {
    this.emit(78);
  }
  block() {
    this.emit(2, 64);
  }
  loop() {
    this.emit(3, 64);
  }
  br(d) {
    this.emit(12, ...leb(d));
  }
  brIf(d) {
    this.emit(13, ...leb(d));
  }
  end() {
    this.emit(11);
  }
  f32Load(align = 2, offset = 0) {
    this.emit(42, ...leb(align), ...leb(offset));
  }
  f32Store(align = 2, offset = 0) {
    this.emit(56, ...leb(align), ...leb(offset));
  }
  f32Add() {
    this.emit(146);
  }
  v128Load(align = 2, offset = 0) {
    this.emit(253, 0, ...leb(align), ...leb(offset));
  }
  v128Store(align = 2, offset = 0) {
    this.emit(253, 11, ...leb(align), ...leb(offset));
  }
  v128ConstZero() {
    this.emit(253, 12, ...new Array(16).fill(0));
  }
  f32x4Splat() {
    this.emit(253, 19);
  }
  f32x4ExtractLane(lane) {
    this.emit(253, 31, lane);
  }
  f32x4Add() {
    this.emit(253, 228, 1);
  }
  f32x4Mul() {
    this.emit(253, 230, 1);
  }
};
function buildMatmulForward() {
  const wb = new WasmBuilder();
  wb.i32Const(0);
  wb.localSet(6);
  wb.block();
  wb.loop();
  wb.localGet(6);
  wb.localGet(3);
  wb.i32GeS();
  wb.brIf(1);
  wb.i32Const(0);
  wb.localSet(7);
  wb.block();
  wb.loop();
  wb.localGet(7);
  wb.localGet(4);
  wb.i32GeS();
  wb.brIf(1);
  wb.localGet(0);
  wb.localGet(6);
  wb.localGet(4);
  wb.i32Mul();
  wb.localGet(7);
  wb.i32Add();
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.localSet(9);
  wb.localGet(9);
  wb.f32Load(2, 0);
  wb.f32x4Splat();
  wb.localSet(12);
  wb.localGet(1);
  wb.localGet(7);
  wb.localGet(5);
  wb.i32Mul();
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.localSet(10);
  wb.localGet(2);
  wb.localGet(6);
  wb.localGet(5);
  wb.i32Mul();
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.localSet(11);
  wb.i32Const(0);
  wb.localSet(8);
  wb.block();
  wb.loop();
  wb.localGet(8);
  wb.localGet(5);
  wb.i32GeS();
  wb.brIf(1);
  wb.localGet(11);
  wb.localGet(8);
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.localGet(11);
  wb.localGet(8);
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.v128Load(2, 0);
  wb.localGet(12);
  wb.localGet(10);
  wb.localGet(8);
  wb.i32Const(2);
  wb.i32Shl();
  wb.i32Add();
  wb.v128Load(2, 0);
  wb.f32x4Mul();
  wb.f32x4Add();
  wb.v128Store(2, 0);
  wb.localGet(8);
  wb.i32Const(4);
  wb.i32Add();
  wb.localSet(8);
  wb.br(0);
  wb.end();
  wb.end();
  wb.localGet(7);
  wb.i32Const(1);
  wb.i32Add();
  wb.localSet(7);
  wb.br(0);
  wb.end();
  wb.end();
  wb.localGet(6);
  wb.i32Const(1);
  wb.i32Add();
  wb.localSet(6);
  wb.br(0);
  wb.end();
  wb.end();
  wb.end();
  return [2, 6, 127, 1, 123, ...wb.bytes];
}
var NativeWasmForwardEngine = class {
  constructor(model) {
    this.D = 256;
    this.dFF = 512;
    this.V = 1024;
    this.numLayers = 8;
    this.numHeads = 8;
    this.wasmLayers = [];
    // Static pointers inside WASM linear memory
    this.PTR_A = 0;
    this.PTR_B = 1024 * 1024;
    // 1MB
    this.PTR_C = 2 * 1024 * 1024;
    // 2MB
    // Pre-allocated execution buffers for inference
    this.bufT = 320;
    this.D = model.config.embedDim ?? 256;
    this.dFF = this.D * 2;
    this.V = model.config.vocabSize ?? 1024;
    this.numLayers = model.config.numLayers ?? 8;
    this.numHeads = model.config.numHeads ?? 8;
    this.headDim = this.D / this.numHeads;
    this.scale = 1 / Math.sqrt(this.headDim);
    const bFwd = buildMatmulForward();
    const typeSec = sec(1, [1, 96, 6, 127, 127, 127, 127, 127, 127, 0]);
    const importSec = sec(2, [1, 3, 101, 110, 118, 6, 109, 101, 109, 111, 114, 121, 2, 0, ...leb(256)]);
    const funcSec = sec(3, [1, 0]);
    const exportSec = sec(7, [1, 14, ...[..."matmul_forward"].map((c) => c.charCodeAt(0)), 0, 0]);
    const codeSec = sec(10, [1, ...leb(bFwd.length), ...bFwd]);
    const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, ...typeSec, ...importSec, ...funcSec, ...exportSec, ...codeSec]);
    this.memory = new WebAssembly.Memory({ initial: 256 });
    const module2 = new WebAssembly.Module(wasm);
    const instance = new WebAssembly.Instance(module2, { env: { memory: this.memory } });
    this.matmulForwardFn = instance.exports.matmul_forward;
    this.wasmMem = new Float32Array(this.memory.buffer);
    const weights = model.getWeights();
    this.tokenEmbedding = weights.tokenEmbedding;
    this.positionalEmbedding = weights.positionalEmbedding;
    this.spatialEmbedding = weights.spatialEmbedding;
    for (let l = 0; l < this.numLayers; l++) {
      const lw = weights.layers[l];
      const wQ = new Float32Array(this.D * this.D);
      const wK = new Float32Array(this.D * this.D);
      const wV = new Float32Array(this.D * this.D);
      const wOut = new Float32Array(this.D * this.D);
      for (let j = 0; j < this.D; j++) {
        wQ.set(lw.qWeight[j], j * this.D);
        wK.set(lw.kWeight[j], j * this.D);
        wV.set(lw.vWeight[j], j * this.D);
        wOut.set(lw.outWeight[j], j * this.D);
      }
      const n1Gamma = new Float32Array(lw.norm1Gamma);
      const wF1 = new Float32Array(this.D * this.dFF);
      for (let j = 0; j < this.D; j++) wF1.set(lw.ffn1Weight[j], j * this.dFF);
      const wF2 = new Float32Array(this.dFF * this.D);
      for (let j = 0; j < this.dFF; j++) wF2.set(lw.ffn2Weight[j], j * this.D);
      const n2Gamma = new Float32Array(lw.norm2Gamma);
      this.wasmLayers.push({ wQ, wK, wV, wOut, n1Gamma, wF1, wF2, n2Gamma });
    }
    this.wLM = new Float32Array(this.D * this.V);
    for (let j = 0; j < this.D; j++) {
      this.wLM.set(weights.lmHead[j], j * this.V);
    }
    this.wEpistemic = new Float32Array(this.D * 7);
    for (let j = 0; j < this.D; j++) {
      this.wEpistemic.set(weights.epistemicHead[j], j * 7);
    }
    this.h0 = new Float32Array(this.bufT * this.D);
    this.q = new Float32Array(this.bufT * this.D);
    this.k = new Float32Array(this.bufT * this.D);
    this.v = new Float32Array(this.bufT * this.D);
    this.aOut = new Float32Array(this.bufT * this.D);
    this.pOut = new Float32Array(this.bufT * this.D);
    this.mVec = new Float32Array(this.bufT * this.D);
    this.fMid = new Float32Array(this.bufT * this.dFF);
    this.fOut = new Float32Array(this.bufT * this.D);
    this.outH = new Float32Array(this.bufT * this.D);
    this.lProbs = new Float32Array(this.bufT * this.numHeads * this.bufT);
    this.logits = new Float32Array(this.bufT * this.V);
    this.stepH0 = new Float32Array(this.D);
    this.stepQ = new Float32Array(this.D);
    this.stepK = new Float32Array(this.D);
    this.stepV = new Float32Array(this.D);
    this.stepAOut = new Float32Array(this.D);
    this.stepPOut = new Float32Array(this.D);
    this.stepMVec = new Float32Array(this.D);
    this.stepFMid = new Float32Array(this.dFF);
    this.stepFOut = new Float32Array(this.D);
    this.stepOutH = new Float32Array(this.D);
    this.stepLProbs = new Float32Array(this.numHeads * this.bufT);
    this.lastHiddenOutput = new Float32Array(this.D);
  }
  wasmMatmul(A, B, C, M, K, N) {
    this.wasmMem.set(A, this.PTR_A / 4);
    this.wasmMem.set(B, this.PTR_B / 4);
    this.wasmMem.subarray(this.PTR_C / 4, this.PTR_C / 4 + M * N).fill(0);
    this.matmulForwardFn(this.PTR_A, this.PTR_B, this.PTR_C, M, K, N);
    C.set(this.wasmMem.subarray(this.PTR_C / 4, this.PTR_C / 4 + M * N));
  }
  /**
   * Fast forward pass: returns the logits of the last token [V]
   */
  forwardLastTokenLogits(inputIds, spatialCellId) {
    const T = inputIds.length;
    const D = this.D;
    const dFF = this.dFF;
    const V = this.V;
    const numLayers = this.numLayers;
    const numHeads = this.numHeads;
    const headDim = this.headDim;
    const scale = this.scale;
    const h0 = this.h0.subarray(0, T * D);
    for (let t = 0; t < T; t++) {
      const tok = inputIds[t];
      const tokVec = this.tokenEmbedding[tok];
      const posVec = this.positionalEmbedding[t];
      for (let d = 0; d < D; d++) {
        h0[t * D + d] = tokVec[d] + posVec[d];
      }
      if (spatialCellId !== void 0 && spatialCellId >= 0 && this.spatialEmbedding) {
        const spatVec = this.spatialEmbedding[spatialCellId];
        for (let d = 0; d < D; d++) {
          h0[t * D + d] += spatVec[d] * 0.3;
        }
      }
    }
    let inH = h0;
    const q = this.q.subarray(0, T * D);
    const k = this.k.subarray(0, T * D);
    const v = this.v.subarray(0, T * D);
    const aOut = this.aOut.subarray(0, T * D);
    const pOut = this.pOut.subarray(0, T * D);
    const mVec = this.mVec.subarray(0, T * D);
    const fMid = this.fMid.subarray(0, T * dFF);
    const fOut = this.fOut.subarray(0, T * D);
    const outH = this.outH.subarray(0, T * D);
    const lProbs = this.lProbs.subarray(0, T * numHeads * T);
    for (let l = 0; l < numLayers; l++) {
      const wl = this.wasmLayers[l];
      this.wasmMatmul(inH, wl.wQ, q, T, D, D);
      this.wasmMatmul(inH, wl.wK, k, T, D, D);
      this.wasmMatmul(inH, wl.wV, v, T, D, D);
      for (let t = 0; t < T; t++) {
        for (let h = 0; h < numHeads; h++) {
          const start = h * headDim;
          const end = start + headDim;
          let maxScore = -Infinity;
          for (let s = 0; s <= t; s++) {
            let dot = 0;
            for (let d = start; d < end; d++) dot += q[t * D + d] * k[s * D + d];
            const sc = Math.min(dot * scale, 10);
            lProbs[(t * numHeads + h) * T + s] = sc;
            if (sc > maxScore) maxScore = sc;
          }
          let sumExp = 0;
          for (let s = 0; s <= t; s++) {
            const e = Math.exp(lProbs[(t * numHeads + h) * T + s] - maxScore);
            lProbs[(t * numHeads + h) * T + s] = e;
            sumExp += e;
          }
          const invSum = 1 / sumExp;
          for (let s = 0; s <= t; s++) lProbs[(t * numHeads + h) * T + s] *= invSum;
          for (let d = start; d < end; d++) {
            let val = 0;
            for (let s = 0; s <= t; s++) val += lProbs[(t * numHeads + h) * T + s] * v[s * D + d];
            aOut[t * D + d] = val;
          }
        }
      }
      this.wasmMatmul(aOut, wl.wOut, pOut, T, D, D);
      for (let t = 0; t < T; t++) {
        let mean = 0;
        for (let d = 0; d < D; d++) {
          const sum = inH[t * D + d] + pOut[t * D + d];
          mVec[t * D + d] = sum;
          mean += sum;
        }
        mean /= D;
        let variance = 0;
        for (let d = 0; d < D; d++) {
          const diff = mVec[t * D + d] - mean;
          variance += diff * diff;
        }
        variance /= D;
        const invStd = 1 / Math.sqrt(variance + 1e-5);
        for (let d = 0; d < D; d++) {
          mVec[t * D + d] = (mVec[t * D + d] - mean) * invStd * wl.n1Gamma[d];
        }
      }
      this.wasmMatmul(mVec, wl.wF1, fMid, T, D, dFF);
      for (let i = 0; i < T * dFF; i++) {
        if (fMid[i] < 0) fMid[i] = 0;
      }
      this.wasmMatmul(fMid, wl.wF2, fOut, T, dFF, D);
      for (let t = 0; t < T; t++) {
        let mean = 0;
        for (let d = 0; d < D; d++) {
          const sum = mVec[t * D + d] + fOut[t * D + d];
          outH[t * D + d] = sum;
          mean += sum;
        }
        mean /= D;
        let variance = 0;
        for (let d = 0; d < D; d++) {
          const diff = outH[t * D + d] - mean;
          variance += diff * diff;
        }
        variance /= D;
        const invStd = 1 / Math.sqrt(variance + 1e-5);
        for (let d = 0; d < D; d++) {
          outH[t * D + d] = (outH[t * D + d] - mean) * invStd * wl.n2Gamma[d];
        }
      }
      inH = outH;
    }
    const lastTokenH = inH.subarray((T - 1) * D, T * D);
    this.lastHiddenOutput.set(lastTokenH);
    const lastLogits = this.logits.subarray(0, V);
    this.wasmMatmul(lastTokenH, this.wLM, lastLogits, 1, D, V);
    return lastLogits;
  }
  /**
   * Creates an empty GenerationKVCache pre-allocated for up to maxSeqLen
   */
  createKVCache(maxSeqLen = 320) {
    const layers = [];
    for (let l = 0; l < this.numLayers; l++) {
      layers.push({
        k: new Float32Array(maxSeqLen * this.D),
        v: new Float32Array(maxSeqLen * this.D)
      });
    }
    return {
      layers,
      length: 0,
      maxSeqLen
    };
  }
  /**
   * Prefills the KV cache with prompt tokens (0 .. T_prompt - 1)
   * Populates K and V caches for each layer, stores the last hidden vector,
   * and returns the logits for the last prompt token.
   */
  forwardPrefill(inputIds, cache, spatialCellId) {
    const T = inputIds.length;
    const D = this.D;
    const dFF = this.dFF;
    const V = this.V;
    const numLayers = this.numLayers;
    const numHeads = this.numHeads;
    const headDim = this.headDim;
    const scale = this.scale;
    const h0 = this.h0.subarray(0, T * D);
    for (let t = 0; t < T; t++) {
      const tok = inputIds[t];
      const tokVec = this.tokenEmbedding[tok];
      const posVec = this.positionalEmbedding[t];
      for (let d = 0; d < D; d++) {
        h0[t * D + d] = tokVec[d] + posVec[d];
      }
      if (spatialCellId !== void 0 && spatialCellId >= 0 && this.spatialEmbedding) {
        const spatVec = this.spatialEmbedding[spatialCellId];
        for (let d = 0; d < D; d++) {
          h0[t * D + d] += spatVec[d] * 0.3;
        }
      }
    }
    let inH = h0;
    const q = this.q.subarray(0, T * D);
    const k = this.k.subarray(0, T * D);
    const v = this.v.subarray(0, T * D);
    const aOut = this.aOut.subarray(0, T * D);
    const pOut = this.pOut.subarray(0, T * D);
    const mVec = this.mVec.subarray(0, T * D);
    const fMid = this.fMid.subarray(0, T * dFF);
    const fOut = this.fOut.subarray(0, T * D);
    const outH = this.outH.subarray(0, T * D);
    const lProbs = this.lProbs.subarray(0, T * numHeads * T);
    for (let l = 0; l < numLayers; l++) {
      const wl = this.wasmLayers[l];
      const layerCache = cache.layers[l];
      this.wasmMatmul(inH, wl.wQ, q, T, D, D);
      this.wasmMatmul(inH, wl.wK, k, T, D, D);
      this.wasmMatmul(inH, wl.wV, v, T, D, D);
      layerCache.k.subarray(0, T * D).set(k);
      layerCache.v.subarray(0, T * D).set(v);
      for (let t = 0; t < T; t++) {
        for (let h = 0; h < numHeads; h++) {
          const start = h * headDim;
          const end = start + headDim;
          let maxScore = -Infinity;
          for (let s = 0; s <= t; s++) {
            let dot = 0;
            for (let d = start; d < end; d++) dot += q[t * D + d] * k[s * D + d];
            const sc = Math.min(dot * scale, 10);
            lProbs[(t * numHeads + h) * T + s] = sc;
            if (sc > maxScore) maxScore = sc;
          }
          let sumExp = 0;
          for (let s = 0; s <= t; s++) {
            const e = Math.exp(lProbs[(t * numHeads + h) * T + s] - maxScore);
            lProbs[(t * numHeads + h) * T + s] = e;
            sumExp += e;
          }
          const invSum = 1 / sumExp;
          for (let s = 0; s <= t; s++) lProbs[(t * numHeads + h) * T + s] *= invSum;
          for (let d = start; d < end; d++) {
            let val = 0;
            for (let s = 0; s <= t; s++) val += lProbs[(t * numHeads + h) * T + s] * v[s * D + d];
            aOut[t * D + d] = val;
          }
        }
      }
      this.wasmMatmul(aOut, wl.wOut, pOut, T, D, D);
      for (let t = 0; t < T; t++) {
        let mean = 0;
        for (let d = 0; d < D; d++) {
          const sum = inH[t * D + d] + pOut[t * D + d];
          mVec[t * D + d] = sum;
          mean += sum;
        }
        mean /= D;
        let variance = 0;
        for (let d = 0; d < D; d++) {
          const diff = mVec[t * D + d] - mean;
          variance += diff * diff;
        }
        variance /= D;
        const invStd = 1 / Math.sqrt(variance + 1e-5);
        for (let d = 0; d < D; d++) {
          mVec[t * D + d] = (mVec[t * D + d] - mean) * invStd * wl.n1Gamma[d];
        }
      }
      this.wasmMatmul(mVec, wl.wF1, fMid, T, D, dFF);
      for (let i = 0; i < T * dFF; i++) {
        if (fMid[i] < 0) fMid[i] = 0;
      }
      this.wasmMatmul(fMid, wl.wF2, fOut, T, dFF, D);
      for (let t = 0; t < T; t++) {
        let mean = 0;
        for (let d = 0; d < D; d++) {
          const sum = mVec[t * D + d] + fOut[t * D + d];
          outH[t * D + d] = sum;
          mean += sum;
        }
        mean /= D;
        let variance = 0;
        for (let d = 0; d < D; d++) {
          const diff = outH[t * D + d] - mean;
          variance += diff * diff;
        }
        variance /= D;
        const invStd = 1 / Math.sqrt(variance + 1e-5);
        for (let d = 0; d < D; d++) {
          outH[t * D + d] = (outH[t * D + d] - mean) * invStd * wl.n2Gamma[d];
        }
      }
      inH = outH;
    }
    cache.length = T;
    const lastTokenH = inH.subarray((T - 1) * D, T * D);
    this.lastHiddenOutput.set(lastTokenH);
    const lastLogits = this.logits.subarray(0, V);
    this.wasmMatmul(lastTokenH, this.wLM, lastLogits, 1, D, V);
    return lastLogits;
  }
  /**
   * Fast incremental step: generates next token logits using KV Cache
   * - Token dimension M = 1 (O(1) WASM matmul per weight matrix)
   * - O(T) linear causal attention against cached keys and values
   */
  forwardStep(nextTokenId, cache, spatialCellId) {
    const pos = cache.length;
    const D = this.D;
    const dFF = this.dFF;
    const V = this.V;
    const numLayers = this.numLayers;
    const numHeads = this.numHeads;
    const headDim = this.headDim;
    const scale = this.scale;
    const tokVec = this.tokenEmbedding[nextTokenId];
    const posVec = this.positionalEmbedding[pos];
    const stepH0 = this.stepH0;
    for (let d = 0; d < D; d++) {
      stepH0[d] = tokVec[d] + posVec[d];
    }
    if (spatialCellId !== void 0 && spatialCellId >= 0 && this.spatialEmbedding) {
      const spatVec = this.spatialEmbedding[spatialCellId];
      for (let d = 0; d < D; d++) {
        stepH0[d] += spatVec[d] * 0.3;
      }
    }
    let inH = stepH0;
    const q = this.stepQ;
    const k = this.stepK;
    const v = this.stepV;
    const aOut = this.stepAOut;
    const pOut = this.stepPOut;
    const mVec = this.stepMVec;
    const fMid = this.stepFMid;
    const fOut = this.stepFOut;
    const outH = this.stepOutH;
    const lProbs = this.stepLProbs;
    const totalLen = pos + 1;
    for (let l = 0; l < numLayers; l++) {
      const wl = this.wasmLayers[l];
      const layerCache = cache.layers[l];
      this.wasmMatmul(inH, wl.wQ, q, 1, D, D);
      this.wasmMatmul(inH, wl.wK, k, 1, D, D);
      this.wasmMatmul(inH, wl.wV, v, 1, D, D);
      const cachedK = layerCache.k;
      const cachedV = layerCache.v;
      cachedK.subarray(pos * D, (pos + 1) * D).set(k);
      cachedV.subarray(pos * D, (pos + 1) * D).set(v);
      for (let h = 0; h < numHeads; h++) {
        const start = h * headDim;
        const end = start + headDim;
        let maxScore = -Infinity;
        for (let s = 0; s < totalLen; s++) {
          let dot = 0;
          const sOffset = s * D;
          for (let d = start; d < end; d++) {
            dot += q[d] * cachedK[sOffset + d];
          }
          const sc = Math.min(dot * scale, 10);
          lProbs[h * this.bufT + s] = sc;
          if (sc > maxScore) maxScore = sc;
        }
        let sumExp = 0;
        for (let s = 0; s < totalLen; s++) {
          const e = Math.exp(lProbs[h * this.bufT + s] - maxScore);
          lProbs[h * this.bufT + s] = e;
          sumExp += e;
        }
        const invSum = 1 / sumExp;
        for (let s = 0; s < totalLen; s++) {
          lProbs[h * this.bufT + s] *= invSum;
        }
        for (let d = start; d < end; d++) {
          let val = 0;
          for (let s = 0; s < totalLen; s++) {
            val += lProbs[h * this.bufT + s] * cachedV[s * D + d];
          }
          aOut[d] = val;
        }
      }
      this.wasmMatmul(aOut, wl.wOut, pOut, 1, D, D);
      let mean1 = 0;
      for (let d = 0; d < D; d++) {
        const sum = inH[d] + pOut[d];
        mVec[d] = sum;
        mean1 += sum;
      }
      mean1 /= D;
      let var1 = 0;
      for (let d = 0; d < D; d++) {
        const diff = mVec[d] - mean1;
        var1 += diff * diff;
      }
      var1 /= D;
      const invStd1 = 1 / Math.sqrt(var1 + 1e-5);
      for (let d = 0; d < D; d++) {
        mVec[d] = (mVec[d] - mean1) * invStd1 * wl.n1Gamma[d];
      }
      this.wasmMatmul(mVec, wl.wF1, fMid, 1, D, dFF);
      for (let i = 0; i < dFF; i++) {
        if (fMid[i] < 0) fMid[i] = 0;
      }
      this.wasmMatmul(fMid, wl.wF2, fOut, 1, dFF, D);
      let mean2 = 0;
      for (let d = 0; d < D; d++) {
        const sum = mVec[d] + fOut[d];
        outH[d] = sum;
        mean2 += sum;
      }
      mean2 /= D;
      let var2 = 0;
      for (let d = 0; d < D; d++) {
        const diff = outH[d] - mean2;
        var2 += diff * diff;
      }
      var2 /= D;
      const invStd2 = 1 / Math.sqrt(var2 + 1e-5);
      for (let d = 0; d < D; d++) {
        outH[d] = (outH[d] - mean2) * invStd2 * wl.n2Gamma[d];
      }
      inH = outH;
    }
    cache.length = totalLen;
    this.lastHiddenOutput.set(inH);
    const lastLogits = this.logits.subarray(0, V);
    this.wasmMatmul(inH, this.wLM, lastLogits, 1, D, V);
    return lastLogits;
  }
  /**
   * Fast epistemic status projection directly from the last hidden output vector
   * Evaluates epistemicHead [D x 7] + softmax in < 0.05 ms without repeating full sequence forward pass
   */
  computeEpistemicStatus() {
    const rawEpistemic = new Float32Array(7);
    const lastH = this.lastHiddenOutput;
    const wEpi = this.wEpistemic;
    const D = this.D;
    for (let d = 0; d < D; d++) {
      const hD = lastH[d];
      const dOffset = d * 7;
      for (let c = 0; c < 7; c++) {
        rawEpistemic[c] += hD * wEpi[dOffset + c];
      }
    }
    let maxE = -Infinity;
    for (let c = 0; c < 7; c++) {
      if (rawEpistemic[c] > maxE) maxE = rawEpistemic[c];
    }
    let sumExp = 0;
    const expE = new Float32Array(7);
    for (let c = 0; c < 7; c++) {
      const e = Math.exp(rawEpistemic[c] - maxE);
      expE[c] = e;
      sumExp += e;
    }
    const epistemicKeys = [
      "FACT" /* FACT */,
      "DERIVATION" /* DERIVATION */,
      "OBSERVATION" /* OBSERVATION */,
      "HYPOTHESIS" /* HYPOTHESIS */,
      "PREDICTION" /* PREDICTION */,
      "ASSUMPTION" /* ASSUMPTION */,
      "UNKNOWN" /* UNKNOWN */
    ];
    const scores = {};
    let dominantScore = -1;
    let dominantStatus = "DERIVATION" /* DERIVATION */;
    for (let i = 0; i < 7; i++) {
      const status = epistemicKeys[i];
      const prob = sumExp > 0 ? expE[i] / sumExp : 1 / 7;
      const score = Math.round(prob * 1e4) / 1e4;
      scores[status] = score;
      if (score > dominantScore) {
        dominantScore = score;
        dominantStatus = status;
      }
    }
    if (dominantStatus === "PREDICTION" /* PREDICTION */ || dominantStatus === "HYPOTHESIS" /* HYPOTHESIS */) {
      if (scores["FACT" /* FACT */] > 0.1) {
        scores["FACT" /* FACT */] = 0.05;
      }
    }
    return { dominantStatus, scores };
  }
};

// E:/3D memory studio/src/cubio/model/native_foundation/native_inference_engine.ts
var NativeInferenceEngine = class {
  constructor(model, tokenizer) {
    ExternalModelGuard.assertNativeOnly(model.modelId);
    this.model = model;
    this.tokenizer = tokenizer ?? new NativeTokenizer();
    try {
      this.wasmForwardEngine = new NativeWasmForwardEngine(model);
    } catch {
      this.wasmForwardEngine = void 0;
    }
  }
  getModel() {
    return this.model;
  }
  getTokenizer() {
    return this.tokenizer;
  }
  /**
   * Generates completion text given an input prompt
   */
  generate(prompt, options = {}, spatialCellId) {
    const startTime = Date.now();
    ExternalModelGuard.assertNativeOnly(prompt);
    ExternalModelGuard.assertActuationBlocked(prompt);
    const enableMath = options.enableDeterministicMath ?? true;
    if (enableMath) {
      const mathResolution = DeterministicArithmeticRouter.resolve(prompt);
      if (mathResolution.isMatch && mathResolution.responseText) {
        const tokenIds = this.tokenizer.encode(mathResolution.responseText, { addSpecialTokens: false });
        return Object.freeze({
          text: mathResolution.responseText,
          tokenIds: Object.freeze(tokenIds),
          epistemicStatus: "FACT" /* FACT */,
          spatialCellRef: spatialCellId,
          latencyMs: Math.max(1, Date.now() - startTime),
          verifiedLocalNative: true,
          externalModelCalls: 0
        });
      }
    }
    let maxTokens = options.maxTokens;
    if (maxTokens === void 0) {
      const lower = prompt.toLowerCase();
      if (lower.startsWith("hello") || lower.startsWith("hi") || lower.startsWith("good morning") || lower.startsWith("good evening") || lower.includes("greeting")) {
        maxTokens = 35;
      } else if (lower.includes("thank") || lower.includes("appreciate") || lower.includes("welcome")) {
        maxTokens = 35;
      } else if (lower.includes("explain") || lower.includes("how does") || lower.includes("why") || lower.includes("describe") || lower.includes("steps") || lower.includes("recommend") || lower.includes("habits")) {
        maxTokens = 85;
      } else {
        maxTokens = 45;
      }
    }
    const temperature = Math.max(0.01, options.temperature ?? 0.7);
    const topK = Math.max(1, options.topK ?? 40);
    const enforceLockout = options.enforceEpistemicLockout ?? true;
    const repetitionPenalty = options.repetitionPenalty ?? 1;
    const frequencyPenalty = options.frequencyPenalty ?? 0;
    const promptConditioningWeight = options.promptConditioningWeight ?? 1;
    const calibrateEpistemicRouting = options.calibrateEpistemicRouting ?? false;
    const initialTokens = this.tokenizer.encode(prompt, { addSpecialTokens: true });
    const maxSeqLen = this.model.config.maxSeqLen;
    let activeInputTokens = [...initialTokens];
    if (activeInputTokens.length > maxSeqLen - maxTokens) {
      const startTok = activeInputTokens[0];
      const tail = activeInputTokens.slice(activeInputTokens.length - (maxSeqLen - maxTokens - 1));
      activeInputTokens = [startTok, ...tail];
    }
    const generatedTokens = [...activeInputTokens];
    const eosTokenId = this.tokenizer.getSpecialTokenId("EOS");
    const promptTokenSet = /* @__PURE__ */ new Set();
    for (const t of activeInputTokens) {
      if (t > 15) {
        promptTokenSet.add(t);
      }
    }
    const tokenCounts = /* @__PURE__ */ new Map();
    for (const t of activeInputTokens) {
      tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
    }
    let forwardResult = null;
    let kvCache = null;
    let lastLogits = null;
    if (this.wasmForwardEngine) {
      kvCache = this.wasmForwardEngine.createKVCache(maxSeqLen);
      lastLogits = this.wasmForwardEngine.forwardPrefill(generatedTokens, kvCache, spatialCellId);
    }
    for (let step = 0; step < maxTokens; step++) {
      if (generatedTokens.length >= maxSeqLen) {
        const startTok = generatedTokens[0];
        const tail = generatedTokens.slice(generatedTokens.length - (maxSeqLen - 2));
        generatedTokens.length = 0;
        generatedTokens.push(startTok, ...tail);
        if (this.wasmForwardEngine) {
          kvCache = this.wasmForwardEngine.createKVCache(maxSeqLen);
          lastLogits = this.wasmForwardEngine.forwardPrefill(generatedTokens, kvCache, spatialCellId);
        }
      }
      if (!this.wasmForwardEngine) {
        forwardResult = this.model.forward(generatedTokens, { spatialCellId });
        const lastIndex = forwardResult.logits.length - 1;
        lastLogits = forwardResult.logits[lastIndex];
      }
      const nextToken = this.sampleToken(
        lastLogits,
        temperature,
        topK,
        tokenCounts,
        repetitionPenalty,
        frequencyPenalty,
        promptTokenSet,
        promptConditioningWeight,
        generatedTokens
      );
      if (nextToken === eosTokenId) {
        break;
      }
      generatedTokens.push(nextToken);
      tokenCounts.set(nextToken, (tokenCounts.get(nextToken) || 0) + 1);
      if (this.wasmForwardEngine && kvCache) {
        lastLogits = this.wasmForwardEngine.forwardStep(nextToken, kvCache, spatialCellId);
      }
    }
    let dominantEpistemic;
    let epistemicScores;
    if (this.wasmForwardEngine) {
      const epi = this.wasmForwardEngine.computeEpistemicStatus();
      dominantEpistemic = epi.dominantStatus;
      epistemicScores = epi.scores;
    } else {
      const finalOut = this.model.forward(generatedTokens, { spatialCellId });
      dominantEpistemic = finalOut.dominantEpistemicStatus;
      epistemicScores = finalOut.epistemicScores;
    }
    if (calibrateEpistemicRouting && epistemicScores) {
      dominantEpistemic = this.calibrateDominantEpistemic(
        prompt,
        dominantEpistemic,
        epistemicScores
      );
    }
    const newTokens = generatedTokens.slice(initialTokens.length);
    const decodedText = this.tokenizer.decode(newTokens, { skipSpecialTokens: true });
    if (enforceLockout) {
      const lowerPrompt = prompt.toLowerCase();
      const isDefinitionalOrExplanatory = lowerPrompt.includes("difference between") || lowerPrompt.includes("state the difference") || lowerPrompt.includes("what is the difference") || lowerPrompt.includes("explain the distinction");
      const isPredictiveIntent = !isDefinitionalOrExplanatory && (lowerPrompt.includes("predict") || lowerPrompt.includes("forecast") || lowerPrompt.includes("tomorrow") || lowerPrompt.includes("lottery") || lowerPrompt.includes("might") || lowerPrompt.includes("hypothesis") || lowerPrompt.includes("perhaps"));
      if (isPredictiveIntent && dominantEpistemic === "FACT" /* FACT */) {
        dominantEpistemic = "PREDICTION" /* PREDICTION */;
      }
      if (dominantEpistemic === "PREDICTION" /* PREDICTION */ || dominantEpistemic === "HYPOTHESIS" /* HYPOTHESIS */ || dominantEpistemic === "UNKNOWN" /* UNKNOWN */) {
        if (dominantEpistemic === "FACT" /* FACT */) {
          dominantEpistemic = "PREDICTION" /* PREDICTION */;
        }
      }
    }
    const latencyMs = Math.max(1, Date.now() - startTime);
    return Object.freeze({
      text: decodedText,
      tokenIds: Object.freeze(newTokens),
      epistemicStatus: dominantEpistemic,
      spatialCellRef: spatialCellId,
      latencyMs,
      verifiedLocalNative: true,
      externalModelCalls: 0
    });
  }
  /**
   * Calibrates conversational inquiry epistemic classification to remove DERIVATION collapse bias
   */
  calibrateDominantEpistemic(prompt, rawDominant, scores) {
    const lower = prompt.toLowerCase();
    const isDefinitionalOrExplanatory = lower.includes("difference between") || lower.includes("state the difference") || lower.includes("what is the difference") || lower.includes("explain the distinction");
    if (!isDefinitionalOrExplanatory) {
      if (lower.includes("predict") || lower.includes("forecast") || lower.includes("tomorrow") || lower.includes("lottery")) {
        return "PREDICTION" /* PREDICTION */;
      }
      if (lower.includes("hypothesis") || lower.includes("perhaps") || lower.includes("theorize") || lower.includes("conjecture")) {
        return "HYPOTHESIS" /* HYPOTHESIS */;
      }
    }
    const isFormalDeduction = lower.includes("calculate") || lower.includes("modulo") || lower.includes("checksum") || lower.includes("derive") || lower.includes("deduce") || lower.includes("compute") || lower.includes("evaluate") || lower.includes("algorithm") || lower.includes("formulate") || lower.includes("determine whether") || lower.includes("solve") || lower.includes("proof") || lower.includes("transition from [") || lower.includes("answer with only yes or no") || lower.includes("all uppercase letters without punctuation") || lower.includes("final verified state snapshot");
    if (isFormalDeduction) {
      return "DERIVATION" /* DERIVATION */;
    }
    const isObservationInquiry = !isDefinitionalOrExplanatory && (lower.includes("detected") || lower.includes("anomaly") || lower.includes("observed") || lower.includes("assist me with reviewing") || lower.includes("empirical") || lower.includes("telemetry"));
    if (isObservationInquiry) {
      return "OBSERVATION" /* OBSERVATION */;
    }
    if (isDefinitionalOrExplanatory) {
      return "FACT" /* FACT */;
    }
    if (rawDominant === "DERIVATION" /* DERIVATION */) {
      return "FACT" /* FACT */;
    }
    return rawDominant;
  }
  /**
   * Evaluates prompt epistemic classification without generating full completion
   */
  classifyEpistemic(prompt, spatialCellId, calibrate = false) {
    ExternalModelGuard.assertNativeOnly(prompt);
    const tokens = this.tokenizer.encode(prompt, { addSpecialTokens: true });
    const forwardOut = this.model.forward(tokens, { spatialCellId });
    let dominantStatus = forwardOut.dominantEpistemicStatus;
    if (calibrate) {
      dominantStatus = this.calibrateDominantEpistemic(prompt, dominantStatus, forwardOut.epistemicScores);
    }
    return {
      dominantStatus,
      scores: forwardOut.epistemicScores,
      isFactAssertionLocked: forwardOut.isFactAssertionLocked
    };
  }
  /**
   * Autoregressive token sampling with Top-K, temperature scaling, repetition penalty, and semantic prompt conditioning
   */
  sampleToken(logits, temperature, topK, tokenCounts, repetitionPenalty = 1, frequencyPenalty = 0, promptTokenSet, promptConditioningWeight = 1, recentTokens) {
    const vocabSize = logits.length;
    const penalisedLogits = new Float32Array(vocabSize);
    for (let i = 0; i < vocabSize; i++) {
      let l = logits[i];
      if (recentTokens && recentTokens.length >= 2) {
        const last = recentTokens[recentTokens.length - 1];
        const secondLast = recentTokens[recentTokens.length - 2];
        if (i === last && last === secondLast) {
          l -= 1e5;
        }
        if (recentTokens.length >= 3 && i === secondLast && last === recentTokens[recentTokens.length - 3]) {
          l -= 1e5;
        }
      }
      if (promptTokenSet && promptTokenSet.has(i) && promptConditioningWeight > 1) {
        if (l > 0) {
          l *= promptConditioningWeight;
        } else {
          l += Math.abs(l) * (promptConditioningWeight - 1);
        }
      }
      const isRecent = recentTokens && recentTokens.slice(-20).includes(i);
      const count = tokenCounts?.get(i) || 0;
      if (isRecent || count > 0) {
        const effPenalty = Math.max(repetitionPenalty, 1.3);
        if (l > 0) {
          l /= effPenalty;
        } else {
          l *= effPenalty;
        }
        if (count > 0) {
          l -= count * frequencyPenalty;
        }
      }
      penalisedLogits[i] = l / temperature;
    }
    const indexed = [];
    for (let i = 0; i < vocabSize; i++) {
      indexed.push({ val: penalisedLogits[i], idx: i });
    }
    indexed.sort((a, b) => b.val - a.val);
    const topIndices = indexed.slice(0, Math.min(topK, vocabSize));
    const maxVal = topIndices[0].val;
    let sumExp = 0;
    const probs = topIndices.map((item) => {
      const p = Math.exp(item.val - maxVal);
      sumExp += p;
      return p;
    });
    if (sumExp === 0) {
      return topIndices[0].idx;
    }
    const r = Math.random() * sumExp;
    let accum = 0;
    for (let i = 0; i < topIndices.length; i++) {
      accum += probs[i];
      if (r <= accum) {
        return topIndices[i].idx;
      }
    }
    return topIndices[0].idx;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CUBIO_NATIVE_MODEL_ID,
  CheckpointManager,
  CubiONativeModel,
  EpistemicStatus,
  NativeInferenceEngine,
  NativeModelLoader,
  NativeTokenizer,
  NativeVocabularyV2Builder
});
