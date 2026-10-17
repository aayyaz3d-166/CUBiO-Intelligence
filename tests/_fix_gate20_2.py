# -*- coding: utf-8 -*-
path = 'F:/ONE language/tests/gate20_benchmark.ts'

with open(path, 'r', encoding='utf-8') as f:
    s = f.read()

# Remove ALL expectMax* occurrences (BenchCase now uses plain max* fields)
s = s.replace('expectMaxSteps', 'maxSteps')
s = s.replace('expectMaxCandidates', 'maxCandidates')
s = s.replace('expectMaxDepth', 'maxDepth')

# Also fix the HO-AMBIG-02 case which used expectSideChannel (interface-aligned)
# CaseResult interface keeps expect* fields (it stores expected AND actual values)
# so that interface is fine; only BenchCase must use plain max* fields.

with open(path, 'w', encoding='utf-8') as f:
    f.write(s)

print('done')
