/**
 * ONE Language — Virtual-to-Physical Cost Analyzer
 * ==================================================
 * Module: @one/memory/extreme/VirtualPhysicalCostAnalyzer
 *
 * Implements Section 20 of Extreme-Scale 3D Memory Toolchain.
 * Computes exact physical resource costs for massive virtual address spaces.
 *
 * CRITICAL SCIENTIFIC PRINCIPLE:
 *   Never labels virtual address representation as 'compression'
 *   unless losslessly recoverable payload information is demonstrated.
 */
export class VirtualPhysicalCostAnalyzer {
    /**
     * Analyzes the real physical cost of maintaining a virtual memory structure.
     */
    static analyze(virtualBytesBigInt, physicalResidentBytes, metadataIndexBytes, cacheBytes, cpuMs, ioBytes, isRecoverableLossless) {
        const totalPhysical = physicalResidentBytes + metadataIndexBytes + cacheBytes;
        const physBig = BigInt(Math.max(1, totalPhysical));
        const ratioBig = virtualBytesBigInt / physBig;
        const formattedVirtual = this.formatBigInt(virtualBytesBigInt);
        return {
            virtualLogicalBytesBigInt: virtualBytesBigInt,
            virtualBytesFormatted: formattedVirtual,
            physicalResidentBytes,
            metadataIndexBytes,
            cacheWorkingSetBytes: cacheBytes,
            totalPhysicalFootprintBytes: totalPhysical,
            virtualToPhysicalFootprintRatio: `${ratioBig.toString()} : 1`,
            cpuComputeCostMs: cpuMs,
            ioCostBytes: ioBytes,
            isLosslessStorageProven: isRecoverableLossless,
            categorization: isRecoverableLossless
                ? 'VERIFIED_LOSSLESS_COMPRESSED_PAYLOAD'
                : 'SPARSE_VIRTUAL_ADDRESS_SPACE',
        };
    }
    static formatBigInt(bytes) {
        const ZB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;
        const EB = 1024n * 1024n * 1024n * 1024n * 1024n * 1024n;
        const PB = 1024n * 1024n * 1024n * 1024n * 1024n;
        const TB = 1024n * 1024n * 1024n * 1024n;
        if (bytes >= ZB)
            return `${(Number(bytes / (ZB / 100n)) / 100).toFixed(2)} ZB`;
        if (bytes >= EB)
            return `${(Number(bytes / (EB / 100n)) / 100).toFixed(2)} EB`;
        if (bytes >= PB)
            return `${(Number(bytes / (PB / 100n)) / 100).toFixed(2)} PB`;
        if (bytes >= TB)
            return `${(Number(bytes / (TB / 100n)) / 100).toFixed(2)} TB`;
        return `${bytes.toString()} Bytes`;
    }
}
