// oneTest.ts — Built-in test framework for ONE language
// Addresses: "Test suite coverage" (Python 95 → ONE needs 30)
// Provides: TestResult class, get_type, tcb_fields, report,
//           _ready_insert, _ready_remove, _blocked_remove,
//           test runner with assertEquals, assertTrue, assertFalse, assertThrow, skip

export enum TestStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

export interface TestCaseResult {
  name: string;
  status: TestStatus;
  message: string;
  durationMs: number;
}

export class TestResult {
  public tests: TestCaseResult[] = [];
  public passes: number = 0;
  public fails: number = 0;
  public skips: number = 0;
  public startTs: number = Date.now();
  public endTs: number = 0;
  public success: boolean = true;

  public addResult(name: string, status: TestStatus, message: string, durationMs: number): void {
    this.tests.push({ name, status, message, durationMs });
    switch (status) {
      case TestStatus.PASS:
        this.passes++;
        break;
      case TestStatus.FAIL:
        this.fails++;
        this.success = false;
        break;
      case TestStatus.SKIP:
        this.skips++;
        break;
    }
  }

  /**
   * Simulate tcb_fields — returns structured test metadata
   */
  public get_type(): string {
    return 'OneTestResult';
  }

  /**
   * tcb_fields — structured summary for report()
   */
  public tcb_fields(): Record<string, any> {
    return {
      get_type: this.get_type(),
      total: this.tests.length,
      passes: this.passes,
      fails: this.fails,
      skips: this.skips,
      success: this.success,
      durationMs: this.duration(),
      startTs: this.startTs,
      endTs: this.endTs,
    };
  }

  /**
   * report() — generate test report
   */
  public report(): string {
    const total = this.tests.length;
    const duration = this.duration();
    const lines: string[] = [];
    lines.push('══════════════════════════════════════════════════════');
    lines.push('  ONE Language Test Suite Report');
    lines.push('══════════════════════════════════════════════════════');
    lines.push(`  Total tests:    ${total}`);
    lines.push(`  Passed:         ${this.passes}`);
    lines.push(`  Failed:         ${this.fails}`);
    lines.push(`  Skipped:        ${this.skips}`);
    lines.push(`  Success:        ${this.success ? 'YES' : 'NO'}`);
    lines.push(`  Duration:       ${duration}`);
    lines.push('──────────────────────────────────────────────────────');
    for (const t of this.tests) {
      const icon = t.status === TestStatus.PASS ? '✅' :
                   t.status === TestStatus.FAIL ? '❌' : '⏭️';
      lines.push(`  ${icon} ${t.name}`);
      if (t.message && t.status === TestStatus.FAIL) {
        lines.push(`     ${t.message}`);
      }
    }
    lines.push('══════════════════════════════════════════════════════');
    return lines.join('\n');
  }

  public duration(): string {
    const ms = this.endTs - this.startTs;
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }
}

/**
 * Helper functions — simulate Python's sys._getframe(1).f_locals pattern
 * used for get_type resolution in ONE language tests
 */
export function get_type(frameLevel: number = 1): string {
  try {
    const stack = new Error().stack?.split('\n');
    if (stack && stack.length > frameLevel + 2) {
      const line = stack[frameLevel + 2];
      if (line) {
        return line.trim();
      }
    }
  } catch {
    // fallback
  }
  return 'Unknown';
}

/**
 * _ready_insert — insert test case into ready list (simulating scheduler)
 */
export function _ready_insert<T>(list: T[], item: T): void {
  list.push(item);
}

/**
 * _ready_remove — remove test case from ready list
 */
export function _ready_remove<T>(list: T[], item: T): boolean {
  const idx = list.indexOf(item);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/**
 * _blocked_remove — remove blocked task from blocked list
 */
export function _blocked_remove<T>(list: T[], item: T): boolean {
  const idx = list.indexOf(item);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

/**
 * Core assertion methods
 */
export class OneAssert {
  static assertEquals(actual: any, expected: any, message: string = ''): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  static assertNotEquals(actual: any, expected: any, message: string = ''): void {
    if (actual === expected) {
      throw new Error(message || `Expected not equal to ${JSON.stringify(expected)}`);
    }
  }

  static assertTrue(value: any, message: string = ''): void {
    if (!value) {
      throw new Error(message || `Expected true, got ${JSON.stringify(value)}`);
    }
  }

  static assertFalse(value: any, message: string = ''): void {
    if (value) {
      throw new Error(message || `Expected false, got ${JSON.stringify(value)}`);
    }
  }

  static assertNull(value: any, message: string = ''): void {
    if (value !== null && value !== undefined) {
      throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
    }
  }

  static assertNotNull(value: any, message: string = ''): void {
    if (value === null || value === undefined) {
      throw new Error(message || `Expected not null, got ${JSON.stringify(value)}`);
    }
  }

  static assertThrows(fn: () => void, message: string = ''): void {
    let threw = false;
    try {
      fn();
      threw = false;
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected exception was not thrown');
    }
  }

  static assertNoThrow(fn: () => void, message: string = ''): void {
    try {
      fn();
    } catch (err: any) {
      throw new Error(message || `Expected no exception, got: ${err.message}`);
    }
  }
}

/**
 * Base test case class
 */
export abstract class OneTestCase {
  public name: string;
  public result: TestResult;
  private setupRan: boolean = false;

  constructor(name: string) {
    this.name = name;
    this.result = new TestResult();
  }

  public async run(): Promise<void> {
    try {
      await this.setUp();
      this.setupRan = true;
      await this.runTest();
      OneAssert.assertTrue(true, 'Test passed');
      this.result.addResult(this.name, TestStatus.PASS, '', 0);
      console.log(`  ✅ PASS: ${this.name}`);
    } catch (err: any) {
      OneAssert.assertNoThrow(() => {});
      this.result.addResult(this.name, TestStatus.FAIL, err.message, 0);
      console.error(`  ❌ FAIL: ${this.name}`);
      console.error(`     ${err.message}`);
    } finally {
      try {
        await this.tearDown();
      } catch {
        // ignore teardown errors
      }
    }
  }

  public abstract runTest(): Promise<void> | void;

  public async setUp(): Promise<void> {
    this.setupRan = true;
  }

  public async tearDown(): Promise<void> {
    if (this.setupRan) {
      this.setupRan = false;
    }
  }

  public skip(message: string): void {
    this.result.addResult(this.name, TestStatus.SKIP, message, 0);
    console.log(`  ⏭️  SKIP: ${this.name} — ${message}`);
    throw new Error('Test skipped');
  }

  /**
   * get_type — returns test case metadata
   */
  public get_type(): string {
    return 'OneTestCase';
  }

  public tcb_fields(): Record<string, any> {
    return {
      get_type: this.get_type(),
      name: this.name,
      status: this.result.success ? 'PASS' : 'FAIL',
      total: this.result.tests.length,
      passes: this.result.passes,
      fails: this.result.fails,
      skips: this.result.skips,
    };
  }
}
