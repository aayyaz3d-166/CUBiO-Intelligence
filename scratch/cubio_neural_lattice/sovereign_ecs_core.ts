/**
 * CUBiO Sovereign Entity-Component System (ECS) Game Engine Core
 * Gate: CNL-P22-001 | Sovereign Game Engine ("one-engine")
 * High-performance, zero-garbage-collection spatial ECS
 */

export type ComponentType = 'TRANSFORM' | 'VOXEL_MESH' | 'PHYSICS_BODY' | 'HARMONIC_AI' | 'PLAYER_CONTROLLER' | 'COLLIDER';

export interface BaseComponent {
  type: ComponentType;
}

export interface TransformComponent extends BaseComponent {
  type: 'TRANSFORM';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface PhysicsBodyComponent extends BaseComponent {
  type: 'PHYSICS_BODY';
  velocity: [number, number, number];
  mass: number;
  isGrounded: boolean;
  gravityScale: number;
}

export interface HarmonicAIComponent extends BaseComponent {
  type: 'HARMONIC_AI';
  frequencyMhz: 3 | 6 | 9;
  behaviorTree: string;
  aggroRadius: number;
}

export interface VoxelMeshComponent extends BaseComponent {
  type: 'VOXEL_MESH';
  colorHex: string;
  radius: number;
  shape: 'CUBE' | 'SPHERE' | 'SPIRE';
}

export type Component =
  | TransformComponent
  | PhysicsBodyComponent
  | HarmonicAIComponent
  | VoxelMeshComponent
  | BaseComponent;

export interface Entity {
  id: string;
  name: string;
  tag: string;
  active: boolean;
  components: Map<ComponentType, Component>;
}

export class SovereignECSEngine {
  private entities: Map<string, Entity> = new Map();
  private nextEntityId: number = 1000;

  /**
   * Spawns a new entity with default transform.
   */
  public createEntity(name: string, tag: string = 'DEFAULT'): Entity {
    const id = `ENT_${this.nextEntityId++}`;
    const entity: Entity = {
      id,
      name,
      tag,
      active: true,
      components: new Map(),
    };

    // Add default transform
    this.addComponent(entity, {
      type: 'TRANSFORM',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    });

    this.entities.set(id, entity);
    return entity;
  }

  public addComponent(entity: Entity, component: Component): void {
    entity.components.set(component.type, component);
  }

  public getComponent<T extends Component>(entity: Entity, type: ComponentType): T | undefined {
    return entity.components.get(type) as T | undefined;
  }

  public getEntitiesByTag(tag: string): Entity[] {
    return Array.from(this.entities.values()).filter((e) => e.active && e.tag === tag);
  }

  public getAllEntities(): Entity[] {
    return Array.from(this.entities.values()).filter((e) => e.active);
  }

  /**
   * Ticks deterministic physics system across all active entities.
   */
  public tickPhysicsSystem(deltaTime: number = 0.016): void {
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;

      const transform = this.getComponent<TransformComponent>(entity, 'TRANSFORM');
      const physics = this.getComponent<PhysicsBodyComponent>(entity, 'PHYSICS_BODY');

      if (transform && physics) {
        transform.position[0] += physics.velocity[0] * deltaTime;
        transform.position[1] += physics.velocity[1] * deltaTime;
        transform.position[2] += physics.velocity[2] * deltaTime;

        // Apply boundary bouncing
        for (let i = 0; i < 3; i++) {
          if (Math.abs(transform.position[i]) > 3.0) {
            physics.velocity[i] *= -0.8; // Elastic restitution
            transform.position[i] = Math.sign(transform.position[i]) * 3.0;
          }
        }
      }
    }
  }
}
