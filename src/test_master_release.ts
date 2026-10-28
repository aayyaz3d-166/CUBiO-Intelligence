import { MasterCertificationRunner } from './core/release/masterCertification';

function runMasterReleaseTest(): void {
  try {
    MasterCertificationRunner.execute();
    console.log('✅ PASS: CubiO Foundation Model v3 Release Candidate Master Certification Succeeded.');
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('\n❌ FAIL: Master Certification Error:');
      console.error(err.message);
    }
    process.exit(1);
  }
}

runMasterReleaseTest();
