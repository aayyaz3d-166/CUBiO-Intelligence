/**
 * CUBiO Harmonic AI NPC Engine
 * Gate: CNL-P22-001 | Sovereign Game World ("one-world")
 * Autonomous living entities operating on 3-6-9 frequency bands
 */

export interface HarmonicNPCActor {
  npcId: string;
  role: 'GUARDIAN' | 'EXPLORER' | 'SAGE';
  harmonicTier: 3 | 6 | 9; // 9 = Reflex, 6 = Tactical, 3 = Strategic
  position: [number, number, number];
  velocity: [number, number, number];
  thoughtStream: string[];
  energyLevel: number;
  currentGoal: string;
}

export interface GossipMessage {
  senderId: string;
  recipientId: string;
  topic: string;
  harmonicPriority: number;
  timestamp: number;
}

export class HarmonicNPCEngine {
  private npcs: Map<string, HarmonicNPCActor> = new Map();
  private gossipLog: GossipMessage[] = [];

  constructor() {
    this.spawnDefaultNPCs();
  }

  private spawnDefaultNPCs(): void {
    this.npcs.set('Actor_Guardian_01', {
      npcId: 'Actor_Guardian_01',
      role: 'GUARDIAN',
      harmonicTier: 9, // 9 MHz Reflex
      position: [0.0, 1.0, 0.0],
      velocity: [0.0, 0.0, 0.0],
      thoughtStream: ['Perception scan active', 'Crystal Spire perimeter secured'],
      energyLevel: 100.0,
      currentGoal: 'PROTECT_CENTRAL_SPIRE',
    });

    this.npcs.set('Actor_Explorer_02', {
      npcId: 'Actor_Explorer_02',
      role: 'EXPLORER',
      harmonicTier: 6, // 6 MHz Tactical
      position: [1.5, 0.0, -1.5],
      velocity: [0.05, 0.0, 0.05],
      thoughtStream: ['Scanning energy ley-lines', 'Mapping quadrant 4 coordinates'],
      energyLevel: 95.5,
      currentGoal: 'MAP_ENERGY_LEYLINES',
    });

    this.npcs.set('Actor_Sage_03', {
      npcId: 'Actor_Sage_03',
      role: 'SAGE',
      harmonicTier: 3, // 3 MHz Strategic
      position: [-1.0, 0.0, 1.0],
      velocity: [0.0, 0.0, 0.0],
      thoughtStream: ['Harmonizing 3-6-9 resonance frequencies', 'Contemplating quantum convergence'],
      energyLevel: 99.0,
      currentGoal: 'MEDITATE_ON_SINGULARITY',
    });
  }

  /**
   * Advances NPC state based on harmonic tick clock.
   */
  public tickNPCs(strobeMhz: 3 | 6 | 9): HarmonicNPCActor[] {
    const updated: HarmonicNPCActor[] = [];

    for (const [id, npc] of this.npcs) {
      if (strobeMhz >= npc.harmonicTier) {
        // Position update
        npc.position[0] += npc.velocity[0];
        npc.position[1] += npc.velocity[1];
        npc.position[2] += npc.velocity[2];

        // Boundary reflection
        for (let i = 0; i < 3; i++) {
          if (Math.abs(npc.position[i]) > 3.0) {
            npc.velocity[i] *= -1;
          }
        }

        // Tier-specific thought generation
        if (npc.harmonicTier === 9) {
          npc.thoughtStream.push(`[9 MHz Reflex] Sensory distance: ${(Math.sqrt(npc.position[0]**2 + npc.position[2]**2)).toFixed(2)}m`);
        } else if (npc.harmonicTier === 6) {
          npc.thoughtStream.push(`[6 MHz Tactical] Gossip dispatched to Guardian: Ley-line active`);
          this.gossipLog.push({
            senderId: npc.npcId,
            recipientId: 'Actor_Guardian_01',
            topic: 'LEYLINE_UPDATE',
            harmonicPriority: 6,
            timestamp: Date.now(),
          });
        } else if (npc.harmonicTier === 3) {
          npc.thoughtStream.push(`[3 MHz Strategic] Goal convergence: ${(npc.energyLevel * 0.99).toFixed(1)}% coherence`);
        }

        if (npc.thoughtStream.length > 5) {
          npc.thoughtStream.shift();
        }

        updated.push(npc);
      }
    }

    return updated;
  }

  public getNPCs(): HarmonicNPCActor[] {
    return Array.from(this.npcs.values());
  }

  public getGossipCount(): number {
    return this.gossipLog.length;
  }
}
