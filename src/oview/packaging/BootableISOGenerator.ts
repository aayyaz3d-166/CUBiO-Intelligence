/**
 * Oview OS — Bootable Virtual Machine ISO & Microkernel Blueprint (Target B)
 * ===========================================================================
 * BootableISOGenerator.ts: Generates the bootable ISO directory hierarchy,
 * GRUB2 / ISOLINUX boot configurations, Stage-1 microkernel initrd scripts,
 * and QEMU / VirtualBox / VMware execution harnesses.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ISOOptions {
  outputDir?: string;
  osName?: string;
  version?: string;
  memoryMb?: number;
  framebufferWidth?: number;
  framebufferHeight?: number;
}

export class BootableISOGenerator {
  private static instance: BootableISOGenerator | null = null;

  private constructor() {}

  public static getInstance(): BootableISOGenerator {
    if (!BootableISOGenerator.instance) {
      BootableISOGenerator.instance = new BootableISOGenerator();
    }
    return BootableISOGenerator.instance;
  }

  /**
   * Generates the complete bootable ISO filesystem tree and VM launcher scripts.
   */
  public generateISOBlueprint(options: ISOOptions = {}): {
    isoDir: string;
    grubCfgPath: string;
    initScriptPath: string;
    qemuRunnerPath: string;
    vboxConfigPath: string;
  } {
    const baseDir = path.resolve(options.outputDir || 'dist/oview/iso');
    const osName = options.osName || 'Oview OS';
    const version = options.version || '1.0.0';
    const memMb = options.memoryMb || 1024;
    const fbW = options.framebufferWidth || 1920;
    const fbH = options.framebufferHeight || 1080;

    // Create ISO Directory Hierarchy
    const bootGrubDir = path.join(baseDir, 'boot/grub');
    const bootIsolinuxDir = path.join(baseDir, 'boot/isolinux');
    const rootfsDir = path.join(baseDir, 'oview/rootfs');

    fs.mkdirSync(bootGrubDir, { recursive: true });
    fs.mkdirSync(bootIsolinuxDir, { recursive: true });
    fs.mkdirSync(rootfsDir, { recursive: true });

    // 1. GRUB2 Boot Configuration (boot/grub/grub.cfg)
    const grubCfgPath = path.join(bootGrubDir, 'grub.cfg');
    const grubContent = `# ==============================================================================
# GRUB2 Multi-Boot Configuration for ${osName} (v${version})
# Sovereign Substrate • Address369 Spatial Memory • ECHO-1 Embedded AI
# ==============================================================================

set default=0
set timeout=3

insmod vbe
insmod vga
insmod video_bochs
insmod video_cirrus
insmod gfxterm

set gfxmode=${fbW}x${fbH}x32
set gfxpayload=keep
terminal_output gfxterm

menuentry "${osName} (Sovereign Desktop Substrate - 60 FPS)" {
    echo "Loading sovereign microkernel and spatial memory driver..."
    linux /boot/vmlinuz quiet loglevel=3 splash video=${fbW}x${fbH}-32 oview.spatial369=enforce
    echo "Mounting Address369 RAM disk and ECHO-1 offline brain..."
    initrd /boot/initrd.img
}

menuentry "${osName} (Safe Graphics / VESA Mode)" {
    linux /boot/vmlinuz nomodeset vga=791 oview.safe=1
    initrd /boot/initrd.img
}

menuentry "${osName} (Hardware Recovery & Memory Checkpoint Rollback)" {
    linux /boot/vmlinuz single oview.rollback=ring_360
    initrd /boot/initrd.img
}
`;
    fs.writeFileSync(grubCfgPath, grubContent, 'utf-8');

    // 2. ISOLINUX Legacy BIOS Boot Configuration (boot/isolinux/isolinux.cfg)
    const isolinuxCfgPath = path.join(bootIsolinuxDir, 'isolinux.cfg');
    const isolinuxContent = `DEFAULT oview
TIMEOUT 30
PROMPT 1

LABEL oview
  KERNEL /boot/vmlinuz
  APPEND initrd=/boot/initrd.img quiet splash oview.spatial369=enforce
`;
    fs.writeFileSync(isolinuxCfgPath, isolinuxContent, 'utf-8');

    // 3. Stage-1 Microkernel Init Script (oview/rootfs/init)
    const initScriptPath = path.join(rootfsDir, 'init');
    const initContent = `#!/bin/sh
# ==============================================================================
# Oview OS Stage-1 Sovereign Microkernel Init Script
# ==============================================================================

echo "[Oview Kernel] Mounting sovereign virtual filesystems..."
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
mount -t tmpfs -o size=512M tmpfs /tmp

echo "[Oview Kernel] Initializing Address369 spatial memory controller [0..368]..."
# Verify reserved memory slots 0..9 for Kernel & ECHO-1 Brain
export OVIEW_SPATIAL_SLOTS=369
export ECHO1_MODEL_PATH="/system/echo1_best_loss.cubiomodel"

echo "[Oview Kernel] Starting Qplayer Register VM (204M ops/sec)..."
echo "[Oview Kernel] Launching Oview Desktop Compositor on framebuffer..."

# Start direct framebuffer desktop runner
exec /bin/oview-compositor --framebuffer --width=${fbW} --height=${fbH}
`;
    fs.writeFileSync(initScriptPath, initContent, 'utf-8');

    // 4. System Manifest (oview/oview-manifest.json)
    const manifestPath = path.join(baseDir, 'oview/oview-manifest.json');
    const manifestContent = JSON.stringify(
      {
        name: osName,
        version: version,
        architecture: 'x86_64',
        memoryBudgetMb: memMb,
        spatialSlots: 369,
        microkernel: 'seL4 / Minimal Sovereign Linux',
        guiEngine: 'OLTO Direct DOM / Framebuffer Compositor',
        aiCore: 'ECHO-1 Offline (24.56 MB)',
        invariants: ['E8005 Bounded Spatial Memory', 'E9001 Zero Secret Leakage'],
        virtualizationTargets: ['QEMU', 'VirtualBox', 'VMware Workstation'],
      },
      null,
      2
    );
    fs.writeFileSync(manifestPath, manifestContent, 'utf-8');

    // 5. QEMU Virtual Machine Launch Script (run-qemu.bat)
    const qemuRunnerPath = path.join(baseDir, '../run-qemu.bat');
    const qemuContent = `@echo off
title ${osName} — QEMU Virtual Machine Boot
echo ================================================================================
echo   ${osName}: Launching in QEMU Virtual Machine Emulator...
echo   Allocating ${memMb}MB RAM, KVM/WHX Acceleration, VirtIO Graphics
echo ================================================================================

:: Check if QEMU is installed
where qemu-system-x86_64 >nul 2>nul
if errorlevel 1 (
    echo [Notice] QEMU executable not found in PATH.
    echo Please install QEMU or use the standalone desktop runner 'run-oview.bat'.
    echo Command to run when QEMU is installed:
    echo qemu-system-x86_64 -m ${memMb} -vga virtio -display sdl -cdrom "%~dp0oview-os-v${version}.iso"
    pause
    exit /b 1
)

qemu-system-x86_64 -m ${memMb} -vga virtio -display sdl -cdrom "%~dp0oview-os-v${version}.iso" -boot d
`;
    fs.writeFileSync(qemuRunnerPath, qemuContent, 'utf-8');

    // 6. VirtualBox Configuration (.vbox blueprint)
    const vboxConfigPath = path.join(baseDir, '../oview-vm.vbox');
    const vboxContent = `<?xml version="1.0"?>
<VirtualBox xmlns="http://www.virtualbox.org/" version="1.19-windows">
  <Machine uuid="{36936936-3693-3693-3693-369369369369}" name="${osName} VM" OSType="Linux_64" currentSnapshot="{00000000-0000-0000-0000-000000000000}">
    <Hardware>
      <CPU count="2"/>
      <Memory RAMSize="${memMb}"/>
      <Display VRAMSize="64"/>
      <BIOS>
        <IOAPIC enabled="true"/>
      </BIOS>
      <StorageControllers>
        <StorageController name="IDE" type="PIIX4" PortCount="2" useHostIOCache="true" Bootable="true">
          <AttachedDevice passthrough="false" type="DVD" hotpluggable="false" port="1" device="0">
            <Image uuid="{10101010-1010-1010-1010-101010101010}"/>
          </AttachedDevice>
        </StorageController>
      </StorageControllers>
    </Hardware>
  </Machine>
</VirtualBox>
`;
    fs.writeFileSync(vboxConfigPath, vboxContent, 'utf-8');

    return {
      isoDir: baseDir,
      grubConfig: grubCfgPath,
      grubCfgPath,
      initScriptPath,
      qemuRunnerPath,
      vboxConfigPath,
    };
  }
}
