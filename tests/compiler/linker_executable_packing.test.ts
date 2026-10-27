import assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import {
  ExecutablePacker,
  OnePackerError,
} from '../../src/one/packer/ExecutablePacker';
import {
  ExecutableValidator,
  KNOWN_OPCODES,
} from '../../src/one/packer/ExecutableValidator';
import {
  ExecutableLinker,
} from '../../src/one/packer/ExecutableLinker';
import {
  ONEX_MAGIC,
  ONEX_HEADER_SIZE,
  ONEX_FORMAT_VERSION_MAJOR,
  ONEX_TARGET_ARCH_VM,
  ONEX_FLAG_ACTUATION_LOCKED,
  ONEX_FLAG_MULTI_FILE_LINKED,
} from '../../src/one/packer/ExecutableArtifact';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { VIGSecurityGuard } from '../../src/one/vig/VIGSecurityGuard';
import { OneDeveloperCLI } from '../../src/one/cli/OneDeveloperCLI';
import { UnifiedIRProgram, createVariable, createRegister } from '../../src/one/ir/UnifiedIR';

export function runLinkerExecutablePackingTests(): void {
  console.log('================================================================================');
  console.log('  ONE LANGUAGE — LINKER & EXECUTABLE PACKING VERIFICATION (T09)');
  console.log('================================================================================\n');

  const projectRoot = path.resolve('.');

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 1: Format Header & Binary Layout Validation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 1] Format Header & Binary Layout Validation (.ox container)...');
  {
    const source = `
      fn calculate(x: Int32): Int32 {
        return x * 3;
      }
      let res = calculate(14);
      print res;
    `;

    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir, 'Expected successful compilation to IR');

    const buffer = ExecutablePacker.pack(comp.ir, { rssMaxLimitMB: 512 });
    assert(Buffer.isBuffer(buffer), 'Expected packed output to be a Buffer');
    assert(buffer.length >= ONEX_HEADER_SIZE, 'Buffer length must be at least 64 bytes');

    // Check magic bytes
    const magic = buffer.slice(0, 4).toString('ascii');
    assert.strictEqual(magic, 'ONEX', 'Header magic must be ONEX');

    // Read header fields
    const header = ExecutablePacker.readHeader(buffer);
    assert.strictEqual(header.magic, 'ONEX');
    assert.strictEqual(header.formatVersionMajor, ONEX_FORMAT_VERSION_MAJOR);
    assert.strictEqual(header.formatVersionMinor, 0);
    assert.strictEqual(header.targetArch, ONEX_TARGET_ARCH_VM);
    assert((header.flags & ONEX_FLAG_ACTUATION_LOCKED) !== 0, 'Flag must have ACTUATION_LOCKED bit');
    assert.strictEqual(header.rssMaxLimitMB, 512);
    assert.strictEqual(header.instructionCount, comp.ir.instructions.length);
    assert(header.payloadSizeBytes > 0, 'Payload size must be positive');
    assert.strictEqual(buffer.length, ONEX_HEADER_SIZE + header.payloadSizeBytes);

    // Validate payload SHA-256 match
    const payload = buffer.slice(ONEX_HEADER_SIZE);
    const expectedSha = crypto.createHash('sha256').update(payload).digest('hex');
    assert.strictEqual(header.payloadSha256, expectedSha, 'Payload SHA-256 in header must match payload bytes');

    console.log('  ✓ Fixed 64-byte binary header, ONEX magic, versioning, flags, and payload hash verified.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 2: Deterministic Bit-Exact Artifact Packing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 2] Deterministic Bit-Exact Artifact Packing (sigma^2 = 0.0)...');
  {
    const source = `
      struct Point { x: Int32, y: Int32 }
      let p = Point { x: 100, y: 200 };
      print p.x;
    `;

    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    // Pack 10 times in a row
    const hashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const buf = ExecutablePacker.pack(comp.ir);
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      hashes.push(h);
    }

    const firstHash = hashes[0];
    for (let i = 1; i < hashes.length; i++) {
      assert.strictEqual(
        hashes[i],
        firstHash,
        `Pack iteration ${i} produced diverging binary hash (sigma^2 > 0.0)`
      );
    }

    console.log(`  ✓ 10 sequential packing runs produced 100% bit-exact identical binary output (Hash: ${firstHash.slice(0, 16)}...).`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 3: Compile -> Link -> Pack -> Load -> Run Pipeline
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 3] Compile -> Link -> Pack -> Load -> Run Pipeline...');
  {
    const source = `
      fn fib(n: Int32): Int32 {
        if (n <= 1) {
          return n;
        }
        return fib(n - 1) + fib(n - 2);
      }
      let ans = fib(10);
      print ans;
    `;

    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    // 1. Pack into binary container
    const buffer = ExecutablePacker.pack(comp.ir);

    // 2. Unpack with integrity check
    const unpackedIR = ExecutablePacker.unpack(buffer);
    assert.strictEqual(unpackedIR.instructions.length, comp.ir.instructions.length);

    // 3. Execute via ExecutableLinker.loadAndRun
    const runRes = ExecutableLinker.loadAndRun(buffer);
    assert.strictEqual(runRes.success, true, 'ExecutableLinker.loadAndRun failed');
    assert(runRes.vmResult);
    assert.strictEqual(runRes.vmResult.success, true);
    assert.deepStrictEqual(runRes.vmResult.output, ['55']); // fib(10) = 55

    // 4. Execute via NativeRuntime
    const nativeRes = ExecutableLinker.loadAndRunNative(buffer);
    assert.strictEqual(nativeRes.success, true, 'ExecutableLinker.loadAndRunNative failed');
    assert(nativeRes.runtimeResult);
    assert.strictEqual(nativeRes.runtimeResult.success, true);
    assert.deepStrictEqual(nativeRes.runtimeResult.output, ['55']);

    console.log('  ✓ Standalone binary executable container loaded and executed on UnifiedVM and NativeRuntime (fib(10) = 55).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 4: Multi-File Linked Module Packing & Execution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 4] Multi-File Linked Module Packing & Execution...');
  {
    const virtualFiles = new Map<string, string>([
      [
        'math/arith.one',
        `
        export fn add(a: Int32, b: Int32): Int32 { return a + b; }
        export fn square(n: Int32): Int32 { return n * n; }
        `,
      ],
      [
        'math/constants.one',
        `
        export let MULTIPLIER = 5;
        `,
      ],
      [
        'app.one',
        `
        import "./math/arith" as Arith;
        import { MULTIPLIER } from "./math/constants";

        let sum = Arith.add(3, 4);
        let sq = Arith.square(sum);
        let total = sq + MULTIPLIER;
        print total;
        `,
      ],
    ]);

    // Link and pack into a single .ox container
    const packRes = ExecutableLinker.linkAndPack('app.one', {
      projectRoot,
      virtualFiles,
    });

    assert.strictEqual(packRes.success, true, 'linkAndPack failed');
    assert(packRes.artifactBuffer, 'Expected artifactBuffer');

    const header = ExecutablePacker.readHeader(packRes.artifactBuffer);
    assert((header.flags & ONEX_FLAG_MULTI_FILE_LINKED) !== 0, 'Expected MULTI_FILE_LINKED flag');

    // Run the packed multi-file executable container
    const runRes = ExecutableLinker.loadAndRun(packRes.artifactBuffer);
    assert.strictEqual(runRes.success, true);
    assert(runRes.vmResult);
    assert.strictEqual(runRes.vmResult.success, true);
    // (3 + 4)^2 + 5 = 49 + 5 = 54
    assert.deepStrictEqual(runRes.vmResult.output, ['54']);

    console.log('  ✓ Multi-file dependency graph linked and packed into single standalone .ox container (output: 54).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 5: Tamper Detection & Cryptographic Integrity Rejection (E8004)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 5] Tamper Detection & Cryptographic Integrity Rejection (E8004)...');
  {
    const source = `let x = 42; print x;`;
    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    const validBuffer = ExecutablePacker.pack(comp.ir);

    // Tamper with a single byte in the payload section (e.g. byte offset 75)
    const tampered = Buffer.from(validBuffer);
    tampered[ONEX_HEADER_SIZE + 10] ^= 0xff; // Invert byte

    const valResult = ExecutablePacker.validateArtifact(tampered);
    assert.strictEqual(valResult.valid, false, 'Tampered buffer must fail validation');
    assert.strictEqual(valResult.errorCode, 'E8004', 'Expected errorCode E8004');
    assert(valResult.error?.includes('integrity check failed'), 'Error message must specify integrity failure');

    // Unpack must throw OnePackerError E8004
    assert.throws(
      () => ExecutablePacker.unpack(tampered),
      (err: any) => err instanceof OnePackerError && err.code === 'E8004'
    );

    console.log('  ✓ Modifying a single payload byte triggers immediate fail-closed E8004 integrity rejection.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 6: Truncated & Incomplete Artifact Rejection (E8003)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 6] Truncated & Incomplete Artifact Rejection (E8003)...');
  {
    const source = `let y = 100; print y;`;
    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    const validBuffer = ExecutablePacker.pack(comp.ir);

    // Case 1: Truncate header (< 64 bytes)
    const shortHeader = validBuffer.slice(0, 32);
    const res1 = ExecutablePacker.validateArtifact(shortHeader);
    assert.strictEqual(res1.valid, false);
    assert.strictEqual(res1.errorCode, 'E8003');

    // Case 2: Truncate payload (drop last 15 bytes)
    const shortPayload = validBuffer.slice(0, validBuffer.length - 15);
    const res2 = ExecutablePacker.validateArtifact(shortPayload);
    assert.strictEqual(res2.valid, false);
    assert.strictEqual(res2.errorCode, 'E8003');
    assert(res2.error?.includes('Payload length mismatch'));

    // Case 3: Appended trailing bytes
    const appended = Buffer.concat([validBuffer, Buffer.from([0x00, 0x01, 0x02])]);
    const res3 = ExecutablePacker.validateArtifact(appended);
    assert.strictEqual(res3.valid, false);
    assert.strictEqual(res3.errorCode, 'E8003');

    console.log('  ✓ Incomplete headers, truncated payloads, and appended trailing bytes rejected with E8003.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 7: Incompatible Version Rejection (E8002)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 7] Incompatible Version Rejection (E8002)...');
  {
    const source = `let z = 1;`;
    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    const validBuffer = ExecutablePacker.pack(comp.ir);

    // Modify major version byte in header (offset 4) from 1 to 2
    const incompatible = Buffer.from(validBuffer);
    incompatible.writeUInt16LE(2, 4);

    const res = ExecutablePacker.validateArtifact(incompatible);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'E8002');
    assert(res.error?.includes('Incompatible executable format version'));

    assert.throws(
      () => ExecutablePacker.unpack(incompatible),
      (err: any) => err instanceof OnePackerError && err.code === 'E8002'
    );

    console.log('  ✓ Incompatible format major versions fail closed with E8002.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 8: Corrupted / Invalid Magic Rejection (E8001)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 8] Corrupted / Invalid Magic Rejection (E8001)...');
  {
    const source = `let z = 1;`;
    const compiler = new UnifiedCompiler();
    const comp = compiler.compile(source);
    assert(comp.success && comp.ir);

    const validBuffer = ExecutablePacker.pack(comp.ir);

    // Corrupt magic bytes from 'ONEX' to 'BADX'
    const corruptMagic = Buffer.from(validBuffer);
    Buffer.from('BADX', 'ascii').copy(corruptMagic, 0, 0, 4);

    const res = ExecutablePacker.validateArtifact(corruptMagic);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'E8001');
    assert(res.error?.includes("Invalid executable magic: expected 'ONEX'"));

    assert.throws(
      () => ExecutablePacker.unpack(corruptMagic),
      (err: any) => err instanceof OnePackerError && err.code === 'E8001'
    );

    console.log('  ✓ Invalid magic identifiers fail closed with E8001.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 9: Corrupted Opcode Stream Rejection (E8007)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 9] Corrupted Opcode Stream Rejection (E8007)...');
  {
    const invalidProgram: UnifiedIRProgram = {
      version: '1.0.0',
      instructions: [
        {
          index: 0,
          opcode: 'CORRUPTED_OPCODE' as any,
          sources: [],
        },
      ],
    };

    const val = ExecutableValidator.validate(invalidProgram);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.errorCode, 'E8007');
    assert(val.error?.includes("Unknown or corrupted opcode 'CORRUPTED_OPCODE'"));

    assert.throws(
      () => ExecutablePacker.pack(invalidProgram),
      (err: any) => err instanceof OnePackerError && err.code === 'E8007'
    );

    console.log('  ✓ Corrupted opcodes intercepted and rejected fail-closed with E8007.');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 10: Mandatory Actuation Lockout Invariant Enforcement (E8005)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 10] Mandatory Actuation Lockout Invariant Enforcement (E8005)...');
  {
    // Case 1: Program with actuationLock === false
    const unlockedProgram: UnifiedIRProgram = {
      version: '1.0.0',
      declarativeMetadata: {
        rssMaxLimitMB: 512,
        actuationLock: false, // VIOLATION!
      },
      instructions: [
        {
          index: 0,
          opcode: 'PRINT',
          sources: [createVariable('x')],
        },
      ],
    };

    const val1 = ExecutableValidator.validate(unlockedProgram);
    assert.strictEqual(val1.valid, false);
    assert.strictEqual(val1.errorCode, 'E8005');

    // Case 2: Program with prohibited actuation command in operand
    const actuateProgram: UnifiedIRProgram = {
      version: '1.0.0',
      instructions: [
        {
          index: 0,
          opcode: 'SPATIAL_OP',
          sources: [createVariable('actuate_motor_arm')], // VIOLATION!
        },
      ],
    };

    const val2 = ExecutableValidator.validate(actuateProgram);
    assert.strictEqual(val2.valid, false);
    assert.strictEqual(val2.errorCode, 'E8005');

    // Case 3: Artifact header missing ONEX_FLAG_ACTUATION_LOCKED bit
    const valid = ExecutablePacker.pack({ version: '1.0.0', instructions: [] });
    const strippedLock = Buffer.from(valid);
    strippedLock.writeUInt16LE(0, 10); // Clear all flags

    const val3 = ExecutablePacker.validateArtifact(strippedLock);
    assert.strictEqual(val3.valid, false);
    assert.strictEqual(val3.errorCode, 'E8005');

    console.log('  ✓ Actuation lockout enforced across program metadata, operands, and header flags (E8005).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 11: Address369 Boundary Enforcement (E8006)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 11] Address369 Boundary Enforcement (E8006)...');
  {
    // Out-of-bounds spatial address (369 is outside [0..368])
    const oobProgram: UnifiedIRProgram = {
      version: '1.0.0',
      instructions: [
        {
          index: 0,
          opcode: 'SPATIAL_OP',
          destination: {
            kind: 'spatial_payload',
            value: { address: 369 }, // VIOLATION: max canonical is 368
          },
          sources: [],
        },
      ],
    };

    const val = ExecutableValidator.validate(oobProgram);
    assert.strictEqual(val.valid, false);
    assert.strictEqual(val.errorCode, 'E8006');
    assert(val.error?.includes('Address369 index 369 is outside canonical range [0..368]'));

    // Valid canonical address boundary (0 and 368)
    const validBoundaryProgram: UnifiedIRProgram = {
      version: '1.0.0',
      instructions: [
        {
          index: 0,
          opcode: 'SPATIAL_OP',
          destination: {
            kind: 'spatial_payload',
            value: { address: 0 }, // Min canonical address
          },
          sources: [
            {
              kind: 'spatial_payload',
              value: { address: 368 }, // Max canonical address
            },
          ],
        },
      ],
    };

    const valOk = ExecutableValidator.validate(validBoundaryProgram);
    assert.strictEqual(valOk.valid, true);

    console.log('  ✓ Canonical Address369 boundaries [0..368] strictly validated before packing (E8006).');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 12: End-to-End CLI Integration (one build -> one run <file.ox>)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Suite 12] End-to-End CLI Integration (one build -> one run <file.ox>)...');
  {
    const tempDir = path.resolve('./temp_packer_cli_test');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    try {
      const sourceFile = path.join(tempDir, 'app.one');
      const sourceCode = `
        fn doubleIt(x: Int32): Int32 {
          return x * 2;
        }
        let v = doubleIt(21);
        print v;
      `;
      fs.writeFileSync(sourceFile, sourceCode, 'utf8');

      // 1. one build <file.one>
      const buildRes = OneDeveloperCLI.run(['build', sourceFile]);
      assert.strictEqual(buildRes.exitCode, 0, `Build failed: ${buildRes.stderr}`);

      const oxFile = path.join(tempDir, 'app.ox');
      const irFile = path.join(tempDir, 'app.one.ir');

      assert(fs.existsSync(irFile), `Expected IR file at ${irFile}`);
      assert(fs.existsSync(oxFile), `Expected binary container at ${oxFile}`);

      const oxBuffer = fs.readFileSync(oxFile);
      assert.strictEqual(oxBuffer.slice(0, 4).toString('ascii'), 'ONEX');

      // 2. one run <file.ox> (Execute packed binary directly without recompiling)
      const logs: string[] = [];
      const runRes = OneDeveloperCLI.handleRun(
        [oxFile],
        (m: string) => logs.push(m),
        (m: string) => console.error(m)
      );

      assert.strictEqual(runRes.exitCode, 0, 'Running .ox failed');
      assert.deepStrictEqual(logs, ['42']);

      console.log('  ✓ CLI workflow confirmed: one build produced app.one.ir + app.ox; one run app.ox executed seamlessly (output: 42).');
    } finally {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  console.log('\n================================================================================');
  console.log('  ALL 12 LINKER & EXECUTABLE PACKING SUITES PASSED (100%)');
  console.log('================================================================================\n');
}

if (require.main === module) {
  runLinkerExecutablePackingTests();
}
