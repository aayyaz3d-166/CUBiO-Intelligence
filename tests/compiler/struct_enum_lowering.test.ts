/**
 * ONE Language — Struct and Enum Semantic Lowering Verification Suite (T04)
 * =========================================================================
 * Path: tests/compiler/struct_enum_lowering.test.ts
 *
 * Verifies end-to-end compilation, typechecking, IR lowering, and VM execution
 * for ONE Language struct and enum features:
 *   - Struct declaration with typed fields (i32, f32, string, bool, nested structs)
 *   - Struct instantiation via constructor call (Point(x, y)) and struct literal (Point { x, y })
 *   - Struct field reads, field writes, and nested field access
 *   - Structural equality (==, !=) for structs
 *   - Enum declaration with auto-increment, explicit integer, and string values
 *   - Enum variant member access and equality comparison
 *   - Diagnostics for duplicate declarations (E2001)
 *   - Diagnostics for unknown field types (E2002)
 *   - Diagnostics for invalid enum variants (E2003)
 *   - Diagnostics for undeclared fields on sealed structs (E2004 / E5008)
 *   - Diagnostics for missing required fields (E2005) and argument count mismatch (E2006)
 *   - Diagnostics for type mismatch on struct fields (E3001)
 *   - Immutability safety for enums (E5010)
 *   - Address369 boundary and actuation lockout verification
 */

import { UnifiedCompiler } from '../../src/one/UnifiedCompiler';
import { UnifiedVM, OneVMError } from '../../src/one/vm/UnifiedVM';
import { CanonicalAddress369 } from '../../src/one/address369_canonical';
import { SpatialBridge } from '../../src/one/spatial/SpatialBridge';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runStructEnumTests(): void {
  console.log('='.repeat(80));
  console.log('  ONE LANGUAGE — STRUCT & ENUM SEMANTIC LOWERING VERIFICATION (T04)');
  console.log('='.repeat(80));

  const compiler = new UnifiedCompiler();

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 1: Struct Declaration & Constructor Instantiation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 1] Struct Declaration & Constructor Instantiation...');
  {
    const src = `
      struct Point {
        x: i32;
        y: i32;
      }

      let p = Point(10, 25);
      print p.x;
      print p.y;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Struct constructor script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === '10', 'p.x must be 10');
    assert(res.vmResult!.output[1] === '25', 'p.y must be 25');
    console.log('  ✓ Constructor-style Point(10, 25) instantiated and read.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 2: Struct Literal Instantiation & In-Place Field Mutation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 2] Struct Literal Instantiation & Field Mutation...');
  {
    const src = `
      struct Vector2 {
        x: f32;
        y: f32;
      }

      let v = Vector2 { x: 1.5, y: 3.5 };
      print v.x;
      print v.y;

      v.x = 9.0;
      v.y = 12.0;
      print v.x;
      print v.y;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Struct literal script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === '1.5', 'Initial v.x must be 1.5');
    assert(res.vmResult!.output[1] === '3.5', 'Initial v.y must be 3.5');
    assert(res.vmResult!.output[2] === '9', 'Mutated v.x must be 9');
    assert(res.vmResult!.output[3] === '12', 'Mutated v.y must be 12');
    console.log('  ✓ Vector2 { x, y } literal and in-place mutation verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 3: Nested Structs
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 3] Nested Structs (Instantiation, Read & Write)...');
  {
    const src = `
      struct Coords {
        x: i32;
        y: i32;
      }

      struct Entity {
        name: string;
        pos: Coords;
        active: bool;
      }

      let e = Entity {
        name: "Drone_01",
        pos: Coords(100, 200),
        active: true
      };

      print e.name;
      print e.pos.x;
      print e.pos.y;
      print e.active;

      e.pos.x = 369;
      print e.pos.x;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Nested struct script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === 'Drone_01', 'e.name matches');
    assert(res.vmResult!.output[1] === '100', 'e.pos.x matches 100');
    assert(res.vmResult!.output[2] === '200', 'e.pos.y matches 200');
    assert(res.vmResult!.output[3] === 'true', 'e.active matches true');
    assert(res.vmResult!.output[4] === '369', 'e.pos.x mutated to 369');
    console.log('  ✓ Nested Entity.pos.x read and write verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 4: Structural Equality for Structs
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 4] Structural Equality (==, !=)...');
  {
    const src = `
      struct Point {
        x: i32;
        y: i32;
      }

      let a = Point(5, 10);
      let b = Point(5, 10);
      let c = Point(5, 11);

      print a == b;
      print a == c;
      print a != c;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Equality script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === 'true', 'a == b must be true');
    assert(res.vmResult!.output[1] === 'false', 'a == c must be false');
    assert(res.vmResult!.output[2] === 'true', 'a != c must be true');
    console.log('  ✓ Structural equality Point(5,10) == Point(5,10) verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 5: Enum Declaration (Auto-increment & Explicit Values)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 5] Enum Declaration & Variant Values...');
  {
    const src = `
      enum Priority {
        Low,
        Medium,
        High
      }

      enum StatusCode {
        Pending = 100,
        Active = 200,
        Closed = 300
      }

      enum Direction {
        North = "N",
        South = "S"
      }

      print Priority.Low;
      print Priority.Medium;
      print Priority.High;
      print StatusCode.Pending;
      print StatusCode.Active;
      print StatusCode.Closed;
      print Direction.North;
      print Direction.South;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Enum declarations must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === '0', 'Priority.Low is 0');
    assert(res.vmResult!.output[1] === '1', 'Priority.Medium is 1');
    assert(res.vmResult!.output[2] === '2', 'Priority.High is 2');
    assert(res.vmResult!.output[3] === '100', 'StatusCode.Pending is 100');
    assert(res.vmResult!.output[4] === '200', 'StatusCode.Active is 200');
    assert(res.vmResult!.output[5] === '300', 'StatusCode.Closed is 300');
    assert(res.vmResult!.output[6] === 'N', 'Direction.North is "N"');
    assert(res.vmResult!.output[7] === 'S', 'Direction.South is "S"');
    console.log('  ✓ Auto-increment, explicit integer, and string enums verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 6: Enum Access & Equality Comparisons
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 6] Enum Access, Variable Binding & Equality...');
  {
    const src = `
      enum State {
        Idle,
        Running,
        Done
      }

      let current = State.Running;
      print current == State.Running;
      print current == State.Idle;
      print current != State.Done;
    `;
    const res = compiler.execute(src);
    assert(res.compilation.success, 'Enum comparison script must compile');
    assert(res.vmResult !== undefined && res.vmResult.success, 'VM execution must succeed');
    assert(res.vmResult!.output[0] === 'true', 'current == State.Running');
    assert(res.vmResult!.output[1] === 'false', 'current == State.Idle');
    assert(res.vmResult!.output[2] === 'true', 'current != State.Done');
    console.log('  ✓ Enum variable binding and equality comparisons verified.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 7: Diagnostics — Duplicate Struct / Enum Declarations (E2001)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 7] Diagnostics: Duplicate Declarations (E2001)...');
  {
    const dupStructSrc = `
      struct Item { id: i32; }
      struct Item { count: i32; }
    `;
    const compStruct = compiler.compile(dupStructSrc);
    assert(!compStruct.success, 'Duplicate struct declaration must fail');
    assert(
      compStruct.diagnostics.some((d) => d.code === 'E2001' && d.message.includes('Item')),
      'Must emit E2001 for duplicate struct Item'
    );

    const dupEnumSrc = `
      enum Mode { Fast, Safe }
      enum Mode { Slow }
    `;
    const compEnum = compiler.compile(dupEnumSrc);
    assert(!compEnum.success, 'Duplicate enum declaration must fail');
    assert(
      compEnum.diagnostics.some((d) => d.code === 'E2001' && d.message.includes('Mode')),
      'Must emit E2001 for duplicate enum Mode'
    );
    console.log('  ✓ Duplicate struct and enum declarations rejected with E2001.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 8: Diagnostics — Unknown Types in Struct Declaration (E2002)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 8] Diagnostics: Unknown Types in Struct Declaration (E2002)...');
  {
    const src = `
      struct InvalidStruct {
        validField: i32;
        invalidField: NonExistentType;
      }
    `;
    const comp = compiler.compile(src);
    assert(!comp.success, 'Struct with unknown type must fail');
    assert(
      comp.diagnostics.some((d) => d.code === 'E2002' && d.message.includes('NonExistentType')),
      'Must emit E2002 for unknown type NonExistentType'
    );
    console.log('  ✓ Unknown field type rejected with E2002.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 9: Diagnostics — Undeclared Field on Sealed Struct (E2004 / E5008)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 9] Diagnostics: Sealed Struct Invariant (E2004 / E5008)...');
  {
    // Compile-time literal undeclared field
    const compileTimeSrc = `
      struct Point { x: i32; y: i32; }
      let p = Point { x: 1, y: 2, z: 3 };
    `;
    const comp = compiler.compile(compileTimeSrc);
    assert(!comp.success, 'Sealed struct with extra field must fail at compile time');
    assert(
      comp.diagnostics.some((d) => d.code === 'E2004' && d.message.includes("Invalid field 'z'")),
      'Must emit E2004 for invalid field z on Point'
    );

    // Compile-time undeclared member read on typed struct variable
    const memberReadSrc = `
      struct Point { x: i32; y: i32; }
      let p: Point = Point(1, 2);
      print p.unknownField;
    `;
    const compRead = compiler.compile(memberReadSrc);
    assert(!compRead.success, 'Reading undeclared field on typed struct must fail');
    assert(
      compRead.diagnostics.some((d) => d.code === 'E2004' && d.message.includes("Field 'unknownField' does not exist")),
      'Must emit E2004 for non-existent field read'
    );

    // Runtime dynamic assignment to undeclared field on sealed struct
    const vm = new UnifiedVM();
    const ir = compiler.compile(`
      struct Point { x: i32; y: i32; }
      let p = Point(1, 2);
    `).ir!;
    ir.instructions.push({
      index: ir.instructions.length,
      opcode: 'FIELD_SET',
      sources: [
        { kind: 'variable', value: 'p' },
        { kind: 'constant', value: 99 },
      ],
      metadata: { field: 'unregisteredField' },
    });
    const vmResult = vm.execute(ir);
    assert(!vmResult.success && vmResult.error?.code === 'E5008', 'VM must report E5008 when setting undeclared field on sealed struct');
    console.log('  ✓ Sealed struct undeclared field insertion rejected at compile-time (E2004) and runtime (E5008).');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 10: Diagnostics — Missing Required Fields & Arg Count Mismatch
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 10] Diagnostics: Missing Fields (E2005) & Arg Count Mismatch (E2006)...');
  {
    const missingSrc = `
      struct Point { x: i32; y: i32; }
      let p = Point { x: 10 };
    `;
    const comp = compiler.compile(missingSrc);
    assert(!comp.success, 'Missing struct field must fail');
    assert(
      comp.diagnostics.some((d) => d.code === 'E2005' && d.message.includes("Missing required field 'y'")),
      'Must emit E2005 for missing field y'
    );

    const argCountSrc = `
      struct Point { x: i32; y: i32; }
      let p = Point(10);
    `;
    const compArg = compiler.compile(argCountSrc);
    assert(!compArg.success, 'Constructor argument count mismatch must fail');
    assert(
      compArg.diagnostics.some((d) => d.code === 'E2006' && d.message.includes('Expected 2 arguments')),
      'Must emit E2006 for argument count mismatch'
    );
    console.log('  ✓ Missing field (E2005) and argument count mismatch (E2006) rejected.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 11: Diagnostics — Unknown Enum Variant (E2003)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 11] Diagnostics: Unknown Enum Variant (E2003)...');
  {
    const src = `
      enum Color { Red, Green, Blue }
      let c = Color.Yellow;
    `;
    const comp = compiler.compile(src);
    assert(!comp.success, 'Accessing unknown enum variant must fail');
    assert(
      comp.diagnostics.some((d) => d.code === 'E2003' && d.message.includes("Unknown enum variant 'Yellow'")),
      'Must emit E2003 for unknown enum variant Yellow'
    );
    console.log('  ✓ Unknown enum variant rejected with E2003.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 12: Diagnostics — Type Mismatch on Struct Fields (E3001)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 12] Diagnostics: Type Mismatch on Struct Fields (E3001)...');
  {
    const srcCall = `
      struct Point { x: i32; y: i32; }
      let p = Point(10, "invalid_string");
    `;
    const compCall = compiler.compile(srcCall);
    assert(!compCall.success, 'Type mismatch in struct constructor must fail');
    assert(
      compCall.diagnostics.some((d) => d.code === 'E3001' && d.message.includes("Type mismatch for field 'y'")),
      'Must emit E3001 for constructor field type mismatch'
    );

    const srcLiteral = `
      struct Point { x: i32; y: i32; }
      let p = Point { x: 10, y: "invalid_string" };
    `;
    const compLit = compiler.compile(srcLiteral);
    assert(!compLit.success, 'Type mismatch in struct literal must fail');
    assert(
      compLit.diagnostics.some((d) => d.code === 'E3001' && d.message.includes("Type mismatch for field 'y'")),
      'Must emit E3001 for literal field type mismatch'
    );
    console.log('  ✓ Struct field type mismatch rejected with E3001.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 13: Immutability Safety — Enum Mutation Rejection (E5010)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 13] Immutability Safety: Enum Mutation Rejection (E5010)...');
  {
    const vm = new UnifiedVM();
    const ir = compiler.compile(`
      enum Status { Active, Idle }
    `).ir!;
    // Attempt to mutate Status.Active at runtime via FIELD_SET
    ir.instructions.push({
      index: ir.instructions.length,
      opcode: 'FIELD_SET',
      sources: [
        { kind: 'variable', value: 'Status' },
        { kind: 'constant', value: 999 },
      ],
      metadata: { field: 'Active' },
    });
    const vmResult = vm.execute(ir);
    assert(!vmResult.success && vmResult.error?.code === 'E5010', 'VM must report E5010 when attempting to mutate enum');
    console.log('  ✓ Enum mutation rejected fail-closed with E5010.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Suite 14: Preservation of Address369 & Actuation Lock Invariants
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[Suite 14] Preserving Address369 Boundaries & Actuation Lock...');
  {
    // 1. Verify 369 addresses remain bijection-exact [0..368]
    assert(CanonicalAddress369.TOTAL_ADDRESSES === 369, 'CanonicalAddress369 must have 369 addresses');
    assert(CanonicalAddress369.SPATIAL_START === 26, 'Spatial start address must be 26');
    assert(CanonicalAddress369.SPATIAL_END === 368, 'Spatial end address must be 368');
    assert(CanonicalAddress369.SYMBOLIC_START === 0, 'Symbolic start address must be 0');
    assert(CanonicalAddress369.SYMBOLIC_END === 25, 'Symbolic end address must be 25');

    // 2. Spatial bridge with actuation lock
    const lockedBridge = new SpatialBridge({ actuationLock: true });
    assert(lockedBridge.isLocked() === true, 'Actuation lock must be active');

    let writeBlocked = false;
    try {
      lockedBridge.set(3, 3, 3, 42);
    } catch (e: any) {
      if (e.message && e.message.includes('E6003')) {
        writeBlocked = true;
      }
    }
    assert(writeBlocked, 'Write on locked bridge must be rejected fail-closed with E6003');

    // 3. Mixed script using both struct and spatial bridge
    const mixedSrc = `
      struct Coordinate {
        x: i32;
        y: i32;
        z: i32;
      }

      let c = Coordinate(3, 3, 3);
      spatial.set(c.x, c.y, c.z, 369);
      let val = spatial.get(c.x, c.y, c.z);
      print val;
    `;
    const openBridge = new SpatialBridge({ actuationLock: false });
    const compMixed = compiler.compile(mixedSrc);
    assert(compMixed.success, 'Mixed struct-spatial program must compile');

    const vmMixed = new UnifiedVM();
    const resMixed = vmMixed.execute(compMixed.ir!, { spatialBridge: openBridge });
    assert(resMixed.success, 'Mixed struct-spatial program must execute');
    assert(resMixed.output[0] === '369', 'Read value via struct coordinates must be 369');

    console.log('  ✓ Address369 canonical boundaries and actuation lock remain 100% intact.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('  ALL 14 STRUCT & ENUM VERIFICATION SUITES PASSED (100%)');
  console.log('='.repeat(80));
}

// Auto-execute if invoked as entrypoint
runStructEnumTests();
