# ONE LANGUAGE — 3/6/9-BIT BINARY LANGUAGE SPECIFICATION (V1.0)

**Document:** `docs/one-language/binary-language-v1.md`  
**Status:** Canonical Reference Standard (Phase 2)  
**Encoding Architecture:** Deterministic Multi-Tier Framing (3-bit, 6-bit, 9-bit)  
**Mathematical Alignment:** CUBiO 7×7×7 (343 Spatial Lattice) & Canonical Address369  

---

## 1. Bit Order, Alignment & Fundamental Units

1. **Bit Order**: Canonical Big-Endian / MSB-First throughout all stream representations.
   - When written as a bitstring: leftmost bit is the Most Significant Bit (MSB, index 0).
   - Bit index $k \in [0..N-1]$ represents weight $2^{(N-1-k)}$.
2. **Fundamental Units**:
   - **Trit/Tri-bit (3-bit unit)**: $2^3 = 8$ distinct codewords (`000` through `111`). Used for stream type classification, header tags, and primitive states.
   - **Hex-bit / Triangle (6-bit unit)**: $2^6 = 64$ distinct codewords (`000000` through `111111`). Used for core instruction opcodes, symbol primitives, and alphanumeric character encoding.
   - **Ennea-bit / Spatial Word (9-bit unit)**: $2^9 = 512$ distinct codewords (`000000000` through `111111111`). Exactly envelopes the CUBiO Canonical Address369 space (`0..368`) with addresses `369..511` explicitly reserved.

---

## 2. Triangle Representation & Geometric Mapping

A 6-bit unit corresponds conceptually to a canonical planar triangle comprising 3 vertices (corners) and 3 edges:

```
            [Corner 1 (C1)]
                 /\
                /  \
     [Edge 1]  /    \  [Edge 3]
      (E1)    /      \   (E3)
             /________\
  [Corner 2]  [Edge 2]  [Corner 3]
     (C2)       (E2)       (C3)
```

### Canonical Position Indexing
The 6 bits are mapped to the geometric positions in deterministic counter-clockwise order:
- **Bit 0 (MSB)**: `Corner 1` (Apex, Top)
- **Bit 1**: `Edge 1` (Left Slant)
- **Bit 2**: `Corner 2` (Bottom-Left Vertex)
- **Bit 3**: `Edge 2` (Base Horizontal Edge)
- **Bit 4**: `Corner 3` (Bottom-Right Vertex)
- **Bit 5 (LSB)**: `Edge 3` (Right Slant)

$$\text{Bit Pattern: } b_0 b_1 b_2 b_3 b_4 b_5 \iff [C_1, E_1, C_2, E_2, C_3, E_3]$$

- Exactly $2^6 = 64$ unique geometric configurations exist.
- Each configuration maps deterministically to a single 6-bit codeword without collision.

---

## 3. Multi-Tier Codebook Classification

### 3.1 3-Bit Code Space (8 Codewords) — Stream Category Prefixes
| 3-Bit Pattern | Hex | Category Marker | Description |
|:---:|:---:|:---|:---|
| `000` | 0x0 | `TYPE_NULL` | Represents `null` value or padding marker |
| `001` | 0x1 | `TYPE_BOOL` | Boolean value prefix (`0`=false, `1`=true) |
| `010` | 0x2 | `TYPE_INT` | Signed Variable-Length Integer |
| `011` | 0x3 | `TYPE_FLOAT` | IEEE 754 64-bit Floating-Point Value |
| `100` | 0x4 | `TYPE_TEXT` | Variable-Length UTF-8 Character Stream |
| `101` | 0x5 | `TYPE_ADDR369` | 9-bit Canonical Address369 Pointer |
| `110` | 0x6 | `TYPE_OPCODE` | 6-bit Instruction Opcode (Triangle Code) |
| `111` | 0x7 | `TYPE_CONTROL` | Stream framing (Barrier, End-of-Stream, Escape) |

---

### 3.2 6-Bit Code Space (64 Codewords) — Triangle Opcodes & Symbols
The 64 codewords are partitioned into 4 functional quartiles (16 words each):

#### Quartile 0 (`0x00`..`0x0F`): Core VM Operations
- `000000` (`0x00`): `OP_NOP` — No Operation
- `000001` (`0x01`): `OP_HALT` — Terminate Execution
- `000010` (`0x02`): `OP_READ` — Read spatial cell at address
- `000011` (`0x03`): `OP_WRITE` — Write value to spatial cell
- `000100` (`0x04`): `OP_INSPECT` — Read metadata without write lock
- `000101` (`0x05`): `OP_PUSH` — Push operand to stack
- `000110` (`0x06`): `OP_POP` — Pop operand from stack
- `000111` (`0x07`): `OP_SWAP` — Swap top two stack elements
- `001000` (`0x08`): `OP_ADD` — Arithmetic Addition
- `001001` (`0x09`): `OP_SUB` — Arithmetic Subtraction
- `001010` (`0x0A`): `OP_MUL` — Arithmetic Multiplication
- `001011` (`0x0B`): `OP_DIV` — Arithmetic Division
- `001100` (`0x0C`): `OP_MOD` — Modulo Operation
- `001101` (`0x0D`): `OP_EQ` — Equality Test (`==`)
- `001110` (`0x0E`): `OP_LT` — Less Than Test (`<`)
- `001111` (`0x0F`): `OP_GT` — Greater Than Test (`>`)

#### Quartile 1 (`0x10`..`0x1F`): Control & Spatial Routing
- `010000` (`0x10`): `OP_JUMP` — Unconditional Jump to Address
- `010001` (`0x11`): `OP_JUMP_IF` — Conditional Jump on Truthy
- `010010` (`0x12`): `OP_CALL` — Subroutine Call
- `010011` (`0x13`): `OP_RET` — Return from Subroutine
- `010100` (`0x14`): `OP_SHELL_ALLOC` — Chebyshev Shell Allocation (r in 0..3)
- `010101` (`0x15`): `OP_ENTROPY_EVAL` — Compute stream Von Neumann entropy S(ρ)
- `010110` (`0x16`): `OP_LOCK_CHECK` — Query fail-closed actuation lock
- `010111` (`0x17`): `OP_BARRIER` — Spatial Memory Sync Barrier
- `011000`..`011111` (`0x18`..`0x1F`): Reserved Instruction Set 1 (Future Expansion)

#### Quartile 2 (`0x20`..`0x2F`): Alphanumeric Radix-64 (Symbols 0–15)
- `100000`..`101111`: Base-64 character mapping subset for compact identifiers.

#### Quartile 3 (`0x30`..`0x3F`): Control Framing Markers & Reserved
- `110000`..`111101` (`0x30`..`0x3D`): Reserved Instruction Set 2
- `111110` (`0x3E`): `MARKER_ESCAPE` — Escape prefix for extended multi-unit payload
- `111111` (`0x3F`): `MARKER_EOS` — End-of-Stream Marker

---

### 3.3 9-Bit Code Space (512 Codewords) — Address369 & Spatial Partition
The 512 nine-bit codes are partitioned as follows:
- `000000000`..`000011001` (`0..25`): **26 Symbolic Registers** (`SYM_A_00`..`SYM_Z_25`).
- `000011010`..`101110000` (`26..368`): **343 Spatial Cells** in $7 \times 7 \times 7$ lattice ($26 + (x + 7y + 49z)$).
- `101110001`..`111111111` (`369..511`): **143 Explicitly Reserved / Out-of-Bounds Codes**. Decoders must fail-closed if referenced.

---

## 4. Value & Stream Framing Formats

Every encoded element begins with a 3-bit category prefix:

### 4.1 Null Value
`[ 000 ]` (3 bits total)

### 4.2 Boolean Value
`[ 001 ] [ bit ]` where `bit=0` is `false`, `bit=1` is `true` (4 bits total)

### 4.3 Integer Value (Sign + Length + Magnitude)
`[ 010 ] [ sign (1 bit) ] [ length_in_bits (6 bits) ] [ magnitude (N bits) ]`
- `sign`: `0` = positive / zero, `1` = negative
- `length_in_bits`: 6-bit unsigned integer $N \in [1..63]$, representing the exact number of magnitude bits
- `magnitude`: $N$ bits Big-Endian unsigned value
- **Canonical zero**: sign `0`, length `1`, magnitude `0` (11 bits total). There is no negative-zero representation.
- **Maximum**: magnitude field supports up to 63 bits, i.e. values up to $2^{63} - 1$.

> **JavaScript number type note.** The generic `BinaryEncoder.encode(value)` path uses `Number.isInteger(value)` to select between integer and float encoding. In JavaScript, `Number.isInteger(3.0) === true` because the runtime does not distinguish the integer `3` from the floating-point `3.0`. Consequently, `encode(3.0)` emits a `TYPE_INT` bitstream, not `TYPE_FLOAT`. The decoded result will be the integer `3`, not a float. **This is correct and expected behavior for this encoding layer; it does not represent a loss of precision for the value `3`.**
>
> - If IEEE-754 Float64 wire representation is required for a whole-number value (e.g. `3.0`, `1.0`, `0.0`), call `BinaryEncoder.encodeFloat(value)` directly. This always emits `TYPE_FLOAT` (tag `011`) regardless of whether the value happens to be a whole number.
> - The decoder's round-trip guarantee for integers is: `decode(encode(n)).value === n` for any integer `n` in $[-2^{63}+1,\ 2^{63}-1]$.
> - The decoder's round-trip guarantee for floats is: `decode(encodeFloat(f)).value === f` for any IEEE-754 representable double, with the exception of NaN (see §4.4).
> - There is no `encode()` round-trip guarantee that distinguishes `int 3` from `float 3.0` on the wire. If type preservation across the wire is needed, use tagged input objects or an explicit `encodeFloat()` call.
>
> *Future API consideration (not implemented):* A typed-value API — e.g. `{ kind: 'int'; value: 3 }` and `{ kind: 'float'; value: 3.0 }` — would allow the encoder to preserve the caller's intent without relying on `Number.isInteger`. This is a design candidate for a future protocol revision and is not part of v1.

### 4.4 Float64 Value (IEEE 754 Big-Endian)
`[ 011 ] [ 64 bits IEEE 754 Float ]` (67 bits total)

- Bit layout: Big-Endian byte order (MSB byte first), matching `DataView.setFloat64(offset, value, false)`.
- **NaN**: JavaScript produces a canonical quiet-NaN bit pattern. The encoder emits the bit pattern as returned by `DataView.getFloat64`. The decoder reproduces `NaN`. Distinct NaN bit patterns (signaling NaN, custom payloads) are not preserved — the JS runtime normalises them.
- **Negative zero**: `-0.0` is preserved; `1 / decode(encodeFloat(-0.0)).value === -Infinity`.
- **Infinity**: `Infinity` and `-Infinity` round-trip exactly.
- **Whole-number floats**: `encodeFloat(3.0)` emits `TYPE_FLOAT` (tag `011`) and `decode(encodeFloat(3.0)).value === 3.0`. However, `encode(3.0)` emits `TYPE_INT` — see §4.3 note.

### 4.5 Text Value (UTF-8 Bytes)
`[ 100 ] [ byte_count (16 bits) ] [ UTF-8 byte stream (8 * byte_count bits) ]`

- `byte_count` is the number of **UTF-8 encoded bytes**, not code points or characters. Maximum: 65 535 bytes.
- The encoder uses the WHATWG `TextEncoder` API, which always produces valid UTF-8.
- The decoder uses `TextDecoder` with default settings (`fatal: false`), which replaces invalid UTF-8 byte sequences with U+FFFD rather than throwing. Invalid UTF-8 can only arise if raw bytes are injected externally; the encoder never produces invalid UTF-8.

### 4.6 Canonical Address369 Value
`[ 101 ] [ 9 bits canonical address in 0..368 ]` (12 bits total)

- The 9-bit payload is the canonical address value directly (not an offset).
- Values `369..511` are reserved; the decoder throws `ADDRESS_OUT_OF_BOUNDS`.

### 4.7 Opcode Instruction Value
`[ 110 ] [ 6 bits triangle opcode ]` (9 bits total)

- Only opcodes classified as `ASSIGNED` in the canonical codebook (`BinaryCodebook.TABLE_6BIT`) are accepted.
- Opcodes classified as `RESERVED` (including the entire ranges `0x18..0x3D` except `0x3E` and `0x3F`) cause the decoder to throw `BinaryError: RESERVED_OPCODE`.
- `MARKER_ESCAPE` (`0x3E`) and `MARKER_EOS` (`0x3F`) are `ASSIGNED` and decode as opcode values; `decodeStream()` does not treat `MARKER_EOS` as a stream terminator — streams end at byte exhaustion.
- No operand format is defined at the binary protocol layer. Opcodes carry no payload; operand conventions are defined by the runtime layer above this protocol.

---

## 5. Error Handling & Incomplete Stream Guarantees

1. **Incomplete Stream**: If input stream terminates before reading a complete framed element, decoder throws `BinaryError: INCOMPLETE_STREAM`.
2. **Invalid Category / Code**: Unrecognized tag patterns throw `BinaryError: INVALID_CODEWORD`.
3. **Reserved Opcode**: A 6-bit opcode value classified as `RESERVED` in the codebook throws `BinaryError: RESERVED_OPCODE`.
4. **Out-of-Bounds Address**: 9-bit values in range `[369..511]` throw `BinaryError: ADDRESS_OUT_OF_BOUNDS`.
5. **Malformed Integer Header**: `length_in_bits === 0` throws `BinaryError: MALFORMED_INTEGER`.
6. **Integer Overflow**: Encoder rejects integers whose magnitude exceeds 63 bits with `BinaryError: INTEGER_OVERFLOW`.
7. **String Overflow**: Encoder rejects strings longer than 65 535 UTF-8 bytes with `BinaryError: STRING_OVERFLOW`.
8. **Zero-Guessing Principle**: The decoder never silently falls back, coerces, or truncates malformed bits.

