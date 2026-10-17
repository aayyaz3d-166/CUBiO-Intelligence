#!/usr/bin/env python3
# -*- coding: utf-8 -*-
path = 'F:/ONE language/tests/gate20_benchmark.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update ALL_SETS to use existing DEV / REGRESSION / HELD_OUT consts (renamed to DEV_CASES etc.)
content = content.replace(
    "cases: DEV_CASES",
    "cases: DEV"
)
content = content.replace(
    "cases: REGRESSION_CASES",
    "cases: REGRESSION"
)
content = content.replace(
    "cases: HELD_OUT_CASES",
    "cases: HELD_OUT"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('renamed OK')
