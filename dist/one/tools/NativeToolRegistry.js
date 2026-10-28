/**
 * ONE Language — Native Tool Registry
 * ====================================
 * Module: @one/tools/NativeToolRegistry
 *
 * Central catalog and discovery hub for all registered One Language native tools.
 * Provides introspection, category filtering, and capability queries.
 */
export class NativeToolRegistry {
    static instance;
    tools = new Map();
    static getInstance() {
        if (!NativeToolRegistry.instance) {
            NativeToolRegistry.instance = new NativeToolRegistry();
        }
        return NativeToolRegistry.instance;
    }
    /**
     * Registers a native tool.
     */
    registerTool(tool) {
        if (this.tools.has(tool.id)) {
            throw new Error(`[NativeToolRegistry Error] Tool with ID '${tool.id}' is already registered.`);
        }
        this.tools.set(tool.id, tool);
    }
    /**
     * Retrieves a tool by ID.
     */
    getTool(id) {
        return this.tools.get(id);
    }
    /**
     * Checks if tool exists.
     */
    hasTool(id) {
        return this.tools.has(id);
    }
    /**
     * Lists all registered tools, optionally filtered by category.
     */
    listTools(category) {
        const all = Array.from(this.tools.values());
        if (!category)
            return all;
        return all.filter((t) => t.category === category);
    }
    /**
     * Returns total count of registered tools.
     */
    count() {
        return this.tools.size;
    }
    /**
     * Unregisters all tools (useful for isolated testing).
     */
    clear() {
        this.tools.clear();
    }
}
