/**
 * CUBiO AI — ONE LANGUAGE
 * =========================================================
 * Module: @one/wasm/WasmSimdMatmul
 *
 * Implements high-performance WebAssembly SIMD (f32x4, v128) matrix multiplication
 * with zero external dependencies or external compilers.
 * Hand-assembled WASM bytecode generator supporting:
 *   1. Forward Matmul: C = A x B
 *   2. Backward Matmul A^T B: C = A^T x B
 *   3. Backward Matmul A B^T: C = A x B^T
 */

function leb(n: number): number[] {
  const bytes: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n !== 0) b |= 0x80;
    bytes.push(b);
  } while (n !== 0);
  return bytes;
}

function sleb(n: number): number[] {
  const bytes: number[] = [];
  let more = true;
  while (more) {
    let byte = n & 0x7f;
    n >>= 7;
    if ((n === 0 && (byte & 0x40) === 0) || (n === -1 && (byte & 0x40) !== 0)) {
      more = false;
    } else {
      byte |= 0x80;
    }
    bytes.push(byte);
  }
  return bytes;
}

function sec(id: number, payload: number[]): number[] {
  return [id, ...leb(payload.length), ...payload];
}

class WasmBuilder {
  public readonly bytes: number[] = [];

  public emit(...b: number[]): void {
    this.bytes.push(...b);
  }

  public i32Const(val: number): void {
    this.emit(0x41, ...sleb(val));
  }

  public localGet(idx: number): void {
    this.emit(0x20, ...leb(idx));
  }

  public localSet(idx: number): void {
    this.emit(0x21, ...leb(idx));
  }

  public i32Add(): void { this.emit(0x6a); }
  public i32Mul(): void { this.emit(0x6c); }
  public i32Shl(): void { this.emit(0x74); }
  public i32GeS(): void { this.emit(0x4e); }

  public block(): void { this.emit(0x02, 0x40); }
  public loop(): void { this.emit(0x03, 0x40); }
  public br(d: number): void { this.emit(0x0c, ...leb(d)); }
  public brIf(d: number): void { this.emit(0x0d, ...leb(d)); }
  public end(): void { this.emit(0x0b); }

  public f32Load(align: number = 2, offset: number = 0): void {
    this.emit(0x2a, ...leb(align), ...leb(offset));
  }

  public f32Store(align: number = 2, offset: number = 0): void {
    this.emit(0x38, ...leb(align), ...leb(offset));
  }

  public f32Add(): void { this.emit(0x92); }

  public v128Load(align: number = 2, offset: number = 0): void {
    this.emit(0xfd, 0x00, ...leb(align), ...leb(offset));
  }

  public v128Store(align: number = 2, offset: number = 0): void {
    this.emit(0xfd, 0x0b, ...leb(align), ...leb(offset));
  }

  public v128ConstZero(): void {
    this.emit(0xfd, 0x0c, ...new Array(16).fill(0));
  }

  public f32x4Splat(): void { this.emit(0xfd, 0x13); }
  public f32x4ExtractLane(lane: number): void { this.emit(0xfd, 0x1f, lane); }
  public f32x4Add(): void { this.emit(0xfd, 0xe4, 0x01); }
  public f32x4Mul(): void { this.emit(0xfd, 0xe6, 0x01); }
}

function buildMatmulForward(): number[] {
  // Args: 0:ptrA, 1:ptrB, 2:ptrC, 3:M, 4:K, 5:N
  // Locals: 6:i, 7:k, 8:j, 9:offA, 10:offB, 11:offC, 12:va
  const wb = new WasmBuilder();
  wb.i32Const(0); wb.localSet(6); // i = 0
  wb.block(); wb.loop();
    wb.localGet(6); wb.localGet(3); wb.i32GeS(); wb.brIf(1); // i >= M
    wb.i32Const(0); wb.localSet(7); // k = 0
    wb.block(); wb.loop();
      wb.localGet(7); wb.localGet(4); wb.i32GeS(); wb.brIf(1); // k >= K
      // offA = ptrA + (i * K + k) * 4
      wb.localGet(0); wb.localGet(6); wb.localGet(4); wb.i32Mul(); wb.localGet(7); wb.i32Add(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(9);
      wb.localGet(9); wb.f32Load(2, 0); wb.f32x4Splat(); wb.localSet(12); // va
      // offB = ptrB + (k * N) * 4
      wb.localGet(1); wb.localGet(7); wb.localGet(5); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(10);
      // offC = ptrC + (i * N) * 4
      wb.localGet(2); wb.localGet(6); wb.localGet(5); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(11);

      wb.i32Const(0); wb.localSet(8); // j = 0
      wb.block(); wb.loop();
        wb.localGet(8); wb.localGet(5); wb.i32GeS(); wb.brIf(1); // j >= N

        // Unrolled 4x4 (16 floats per iteration) if possible, else 4 floats
        wb.localGet(11); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.localGet(11); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.localGet(12);
        wb.localGet(10); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.f32x4Mul();
        wb.f32x4Add();
        wb.v128Store(2, 0);

        wb.localGet(8); wb.i32Const(4); wb.i32Add(); wb.localSet(8);
        wb.br(0);
      wb.end(); wb.end();

      wb.localGet(7); wb.i32Const(1); wb.i32Add(); wb.localSet(7);
      wb.br(0);
    wb.end(); wb.end();
    wb.localGet(6); wb.i32Const(1); wb.i32Add(); wb.localSet(6);
    wb.br(0);
  wb.end(); wb.end();
  wb.end();
  return [2, 6, 0x7f, 1, 0x7b, ...wb.bytes];
}

function buildMatmulAtB(): number[] {
  // A: [M, K] -> A^T: [K, M], B: [M, N], C: [K, N]
  // C[k, j] += A[m, k] * B[m, j]
  const wb = new WasmBuilder();
  wb.i32Const(0); wb.localSet(6); // m = 0
  wb.block(); wb.loop();
    wb.localGet(6); wb.localGet(3); wb.i32GeS(); wb.brIf(1); // m >= M
    wb.i32Const(0); wb.localSet(7); // k = 0
    wb.block(); wb.loop();
      wb.localGet(7); wb.localGet(4); wb.i32GeS(); wb.brIf(1); // k >= K
      // offA = ptrA + (m * K + k) * 4
      wb.localGet(0); wb.localGet(6); wb.localGet(4); wb.i32Mul(); wb.localGet(7); wb.i32Add(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(9);
      wb.localGet(9); wb.f32Load(2, 0); wb.f32x4Splat(); wb.localSet(12); // va
      // offB = ptrB + (m * N) * 4
      wb.localGet(1); wb.localGet(6); wb.localGet(5); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(10);
      // offC = ptrC + (k * N) * 4
      wb.localGet(2); wb.localGet(7); wb.localGet(5); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(11);

      wb.i32Const(0); wb.localSet(8); // j = 0
      wb.block(); wb.loop();
        wb.localGet(8); wb.localGet(5); wb.i32GeS(); wb.brIf(1); // j >= N
        wb.localGet(11); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.localGet(11); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.localGet(12);
        wb.localGet(10); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.f32x4Mul();
        wb.f32x4Add();
        wb.v128Store(2, 0);

        wb.localGet(8); wb.i32Const(4); wb.i32Add(); wb.localSet(8);
        wb.br(0);
      wb.end(); wb.end();

      wb.localGet(7); wb.i32Const(1); wb.i32Add(); wb.localSet(7);
      wb.br(0);
    wb.end(); wb.end();
    wb.localGet(6); wb.i32Const(1); wb.i32Add(); wb.localSet(6);
    wb.br(0);
  wb.end(); wb.end();
  wb.end();
  return [2, 6, 0x7f, 1, 0x7b, ...wb.bytes];
}

function buildMatmulAbT(): number[] {
  // A: [M, K], B: [N, K], C: [M, N]
  // C[i, j] = sum_k A[i, k] * B[j, k]
  const wb = new WasmBuilder();
  wb.i32Const(0); wb.localSet(6); // i = 0
  wb.block(); wb.loop();
    wb.localGet(6); wb.localGet(3); wb.i32GeS(); wb.brIf(1); // i >= M
    wb.i32Const(0); wb.localSet(7); // j = 0
    wb.block(); wb.loop();
      wb.localGet(7); wb.localGet(5); wb.i32GeS(); wb.brIf(1); // j >= N

      // offA = ptrA + (i * K) * 4
      wb.localGet(0); wb.localGet(6); wb.localGet(4); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(9);
      // offB = ptrB + (j * K) * 4
      wb.localGet(1); wb.localGet(7); wb.localGet(4); wb.i32Mul(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(10);
      // offC = ptrC + (i * N + j) * 4
      wb.localGet(2); wb.localGet(6); wb.localGet(5); wb.i32Mul(); wb.localGet(7); wb.i32Add(); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
      wb.localSet(11);

      // acc = 0 (v128)
      wb.v128ConstZero(); wb.localSet(12);

      wb.i32Const(0); wb.localSet(8); // k = 0
      wb.block(); wb.loop();
        wb.localGet(8); wb.localGet(4); wb.i32GeS(); wb.brIf(1); // k >= K
        wb.localGet(12);
        wb.localGet(9); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.localGet(10); wb.localGet(8); wb.i32Const(2); wb.i32Shl(); wb.i32Add();
        wb.v128Load(2, 0);
        wb.f32x4Mul();
        wb.f32x4Add();
        wb.localSet(12);

        wb.localGet(8); wb.i32Const(4); wb.i32Add(); wb.localSet(8);
        wb.br(0);
      wb.end(); wb.end();

      // C[offC] = horizontal_sum(acc)
      wb.localGet(11);
      wb.localGet(12); wb.f32x4ExtractLane(0);
      wb.localGet(12); wb.f32x4ExtractLane(1);
      wb.f32Add();
      wb.localGet(12); wb.f32x4ExtractLane(2);
      wb.f32Add();
      wb.localGet(12); wb.f32x4ExtractLane(3);
      wb.f32Add();
      wb.f32Store(2, 0);

      wb.localGet(7); wb.i32Const(1); wb.i32Add(); wb.localSet(7);
      wb.br(0);
    wb.end(); wb.end();
    wb.localGet(6); wb.i32Const(1); wb.i32Add(); wb.localSet(6);
    wb.br(0);
  wb.end(); wb.end();
  wb.end();
  return [2, 6, 0x7f, 1, 0x7b, ...wb.bytes];
}

export interface WasmSimdInstance {
  memory: WebAssembly.Memory;
  matmulForward: (ptrA: number, ptrB: number, ptrC: number, M: number, K: number, N: number) => void;
  matmulAtB: (ptrA: number, ptrB: number, ptrC: number, M: number, K: number, N: number) => void;
  matmulAbT: (ptrA: number, ptrB: number, ptrC: number, M: number, K: number, N: number) => void;
}

export function createWasmSimdMatmul(initialPages: number = 256): WasmSimdInstance {
  const bFwd = buildMatmulForward();
  const bAtB = buildMatmulAtB();
  const bAbT = buildMatmulAbT();

  const typeSec = sec(1, [1, 0x60, 6, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0]);
  const importSec = sec(2, [1, 3, 0x65, 0x6e, 0x76, 6, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 2, 0, ...leb(initialPages)]);
  const funcSec = sec(3, [3, 0, 0, 0]);
  const exportSec = sec(7, [
    3,
    14, ...[...'matmul_forward'].map(c => c.charCodeAt(0)), 0, 0,
    11, ...[...'matmul_at_b'].map(c => c.charCodeAt(0)), 0, 1,
    11, ...[...'matmul_ab_t'].map(c => c.charCodeAt(0)), 0, 2,
  ]);
  const codeSec = sec(10, [
    3,
    ...leb(bFwd.length), ...bFwd,
    ...leb(bAtB.length), ...bAtB,
    ...leb(bAbT.length), ...bAbT,
  ]);

  const wasm = new Uint8Array([
    0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...typeSec,
    ...importSec,
    ...funcSec,
    ...exportSec,
    ...codeSec,
  ]);

  const memory = new WebAssembly.Memory({ initial: initialPages });
  const module = new WebAssembly.Module(wasm);
  const instance = new WebAssembly.Instance(module, { env: { memory } });

  return {
    memory,
    matmulForward: instance.exports.matmul_forward as any,
    matmulAtB: instance.exports.matmul_at_b as any,
    matmulAbT: instance.exports.matmul_ab_t as any,
  };
}
