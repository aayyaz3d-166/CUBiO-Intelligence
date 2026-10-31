/**
 * CUBiO Prompt-to-Game Compiler & Visual Scripting Engine
 * Gate: CNL-P22-001 | Sovereign Game Engine ("one-engine")
 * Compiles Roman Urdu & English prompts into executable ECS Game Entities
 */

import { SovereignECSEngine, Entity } from './sovereign_ecs_core';

export interface GameEntityArchetype {
  name: string;
  tag: string;
  colorHex: string;
  speed: number;
  harmonicFreq: 3 | 6 | 9;
  shape: 'CUBE' | 'SPHERE' | 'SPIRE';
  generatedRule: string;
}

export class PromptToGameCompiler {
  private ecs: SovereignECSEngine;

  constructor(ecs: SovereignECSEngine) {
    this.ecs = ecs;
  }

  /**
   * Compiles natural prompt into a fully initialized ECS Entity.
   */
  public compilePromptToEntity(prompt: string): Entity {
    const lower = prompt.toLowerCase();
    let name = 'Custom_Game_Actor';
    let tag = 'NPC';
    let color = '#06b6d4'; // Cyan default
    let speed = 2.0;
    let freq: 3 | 6 | 9 = 6;
    let shape: 'CUBE' | 'SPHERE' | 'SPIRE' = 'SPHERE';

    // Parse Role / Name
    if (lower.includes('shooter') || lower.includes('enemy') || lower.includes('dushman')) {
      name = 'Enemy_Shooter';
      tag = 'ENEMY';
      color = '#ef4444'; // Red
      freq = 9;
    } else if (lower.includes('fast') || lower.includes('speed') || lower.includes('runner')) {
      name = 'Speed_Runner';
      tag = 'RUNNER';
      color = '#f59e0b'; // Amber
      speed = 4.5;
      freq = 9;
    } else if (lower.includes('healer') || lower.includes('sage') || lower.includes('support')) {
      name = 'Support_Sage';
      tag = 'ALLY';
      color = '#10b981'; // Emerald
      freq = 3;
    } else if (lower.includes('boss') || lower.includes('giant')) {
      name = 'Sovereign_Titan';
      tag = 'BOSS';
      color = '#8b5cf6'; // Purple
      shape = 'SPIRE';
      freq = 9;
    }

    // Parse Frequencies
    if (lower.includes('9 mhz') || lower.includes('9mhz') || lower.includes('reflex')) {
      freq = 9;
    } else if (lower.includes('6 mhz') || lower.includes('6mhz') || lower.includes('tactical')) {
      freq = 6;
    } else if (lower.includes('3 mhz') || lower.includes('3mhz') || lower.includes('strategic')) {
      freq = 3;
    }

    // Spawn Entity in ECS
    const entity = this.ecs.createEntity(name, tag);

    this.ecs.addComponent(entity, {
      type: 'PHYSICS_BODY',
      velocity: [speed * 0.5, 0, speed * 0.5],
      mass: 1.0,
      isGrounded: true,
      gravityScale: 1.0,
    });

    this.ecs.addComponent(entity, {
      type: 'VOXEL_MESH',
      colorHex: color,
      radius: shape === 'SPIRE' ? 1.5 : 0.8,
      shape,
    });

    this.ecs.addComponent(entity, {
      type: 'HARMONIC_AI',
      frequencyMhz: freq,
      behaviorTree: `AI_BEHAVIOR_${tag}_FREQ_${freq}`,
      aggroRadius: 4.0,
    });

    return entity;
  }
}
