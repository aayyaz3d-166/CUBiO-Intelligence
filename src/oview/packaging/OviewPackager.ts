/**
 * Oview OS — Master Production Distribution Packager
 * ===================================================
 * OviewPackager.ts: Coordinates Target A (Standalone Desktop App Bundle)
 * and Target B (Virtual Machine Bootable ISO Blueprint) into a production release.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DesktopRunner } from './DesktopRunner';
import { BootableISOGenerator } from './BootableISOGenerator';

export interface DistributionArtifacts {
  releaseDir: string;
  standaloneHtml: string;
  desktopBatRunner: string;
  desktopPs1Runner: string;
  isoDirectory: string;
  grubConfig: string;
  qemuRunner: string;
  vboxConfig: string;
  manifestPath: string;
  buildTimeMs: number;
}

export class OviewPackager {
  private static instance: OviewPackager | null = null;
  private desktopRunner: DesktopRunner;
  private isoGenerator: BootableISOGenerator;

  private constructor() {
    this.desktopRunner = DesktopRunner.getInstance();
    this.isoGenerator = BootableISOGenerator.getInstance();
  }

  public static getInstance(): OviewPackager {
    if (!OviewPackager.instance) {
      OviewPackager.instance = new OviewPackager();
    }
    return OviewPackager.instance;
  }

  /**
   * Builds the entire production distribution for both Target A and Target B.
   */
  public packageDistribution(outputDir: string = 'dist/oview'): DistributionArtifacts {
    const t0 = performance.now();
    const releaseDir = path.resolve(outputDir);
    fs.mkdirSync(releaseDir, { recursive: true });

    // 1. Build Target A: Standalone Desktop Bundle & Native Runners
    const desktopArtifacts = this.desktopRunner.generateBundle({
      outputDir: releaseDir,
      width: 1366,
      height: 840,
    });

    // 2. Build Target B: Bootable VM ISO Blueprint & Virtualization Configs
    const isoArtifacts = this.isoGenerator.generateISOBlueprint({
      outputDir: path.join(releaseDir, 'iso'),
      osName: 'Oview OS',
      version: '1.0.0',
      memoryMb: 1024,
      framebufferWidth: 1920,
      framebufferHeight: 1080,
    });

    // 3. Write Master Release Manifest
    const manifestPath = path.join(releaseDir, 'release-manifest.json');
    const manifest = {
      product: 'Oview OS',
      edition: 'Sovereign Production Edition',
      version: '1.0.0',
      buildTimestamp: Date.now(),
      substrate: 'ONE Language v1.3.0',
      guiEngine: 'OLTO Frontend Reactive Engine',
      aiCore: 'ECHO-1 Offline Brain (24.56 MB)',
      memoryArchitecture: 'Address369 Bounded Spatial Slots [0..368]',
      targets: {
        targetA: {
          type: 'Standalone Portable Desktop App',
          files: ['index.html', 'run-oview.bat', 'run-oview.ps1'],
          dependencies: 'Zero (Runs via Native Desktop WebView)',
        },
        targetB: {
          type: 'Virtual Machine Bootable ISO Blueprint',
          files: ['iso/boot/grub/grub.cfg', 'iso/oview/rootfs/init', 'run-qemu.bat', 'oview-vm.vbox'],
          virtualization: ['QEMU', 'VirtualBox', 'VMware'],
        },
      },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    const buildTimeMs = Number((performance.now() - t0).toFixed(2));

    return {
      releaseDir,
      standaloneHtml: desktopArtifacts.htmlPath,
      desktopBatRunner: desktopArtifacts.batPath,
      desktopPs1Runner: desktopArtifacts.ps1Path,
      isoDirectory: isoArtifacts.isoDir,
      grubConfig: isoArtifacts.grubCfgPath,
      qemuRunner: isoArtifacts.qemuRunnerPath,
      vboxConfig: isoArtifacts.vboxConfigPath,
      manifestPath,
      buildTimeMs,
    };
  }
}
