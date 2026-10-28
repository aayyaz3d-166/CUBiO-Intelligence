# ONE LANGUAGE — AUDIT COMMANDS AND LOGS

**Audit Session:** Master Audit Gates 10–26 (Run 2)  
**Date:** 2026-10-11  

---

## Commands Executed During Audit

```powershell
# 1. Protected SHA-256 Hash Verification
Get-FileHash -Algorithm SHA256 "E:\3D memory studio\data\checkpoints\one_lm_v1\one_lm_best.cubiomodel", "src\binary\binaryCodebook.ts", "src\binary\binaryDecoder.ts", "src\binary\binaryEncoder.ts"

# Result:
# one_lm_best.cubiomodel : 2D35BB53A226FD369C3B282C1EA6A0D039F66A3557D31A77EAC72ED8C9DBF948 (MATCH)
# binaryCodebook.ts      : EBE03AC18ACC395A0BF3E5E9F78DE648E4755D44FD9C5C5DF9CA8639D85FDE49 (MATCH)
# binaryDecoder.ts       : 68B5AE692B8C483B575A76F2B205912255F0717CB0039EFB47C885455D87DDCA (MATCH)
# binaryEncoder.ts       : 43A6133B1E9243C5DD9503ABCCCFD979D2E107F97CA8BF330C545E5801CB15E7 (MATCH)

# 2. Test Execution Verification Commands
npx ts-node --transpile-only tests/phase1_bridge_verification.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/binary/phase2_binary_language.test.ts
# Exit Code: 1 (ERR_UNSUPPORTED_DIR_IMPORT)

npx ts-node --transpile-only tests/reasoning/phase3_reasoning_engine.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/memory/phase4_memory_layer.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/hybrid/phase5_gate4_native5m_integration.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/hybrid/phase5_gate6_conversational_quality.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/hybrid/phase5_gate8_reasoning_relationship_conversational.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)

npx ts-node --transpile-only tests/hybrid/phase5_hybrid_conversation.test.ts
# Exit Code: 1 (ERR_MODULE_NOT_FOUND)
```
