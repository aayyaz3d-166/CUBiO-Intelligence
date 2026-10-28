/**
 * ONE Language — Native Tool Registry
 * ====================================
 * Module: @one/tools/NativeToolRegistry
 *
 * Central catalog and discovery hub for all registered One Language native tools.
 * Provides introspection, category filtering, and capability queries.
 */

import { INativeTool, ToolCategory } from './INativeTool';

export class NativeToolRegistry {
  private static instance?: NativeToolRegistry;
  private tools: Map<string, INativeTool> = new Map();

  public static getInstance(): NativeToolRegistry {
    if (!NativeToolRegistry.instance) {
      NativeToolRegistry.instance = new NativeToolRegistry();
    }
    return NativeToolRegistry.instance;
  }

  /**
   * Registers a native tool.
   */
  public registerTool(tool: INativeTool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`[NativeToolRegistry Error] Tool with ID '${tool.id}' is already registered.`);
    }
    this.tools.set(tool.id, tool);
  }

  /**
   * Retrieves a tool by ID.
   */
  public getTool(id: string): INativeTool | undefined {
    return this.tools.get(id);
  }

  /**
   * Checks if tool exists.
   */
  public hasTool(id: string): boolean {
    return this.tools.has(id);
  }

  /**
   * Lists all registered tools, optionally filtered by category.
   */
  public listTools(category?: ToolCategory): INativeTool[] {
    const all = Array.from(this.tools.values());
    if (!category) return all;
    return all.filter((t) => t.category === category);
  }

  /**
   * Returns total count of registered tools.
   */
  public count(): number {
    return this.tools.size;
  }

  /**
   * Unregisters all tools (useful for isolated testing).
   */
  public clear(): void {
    this.tools.clear();
  }
}
