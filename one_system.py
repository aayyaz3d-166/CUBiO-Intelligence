# ==========================================
# CUBiO UNIFIED SYSTEM: MULTI-CUBE & 3-6-9 HARMONIC RUNTIME
# Root: 1 | Coordinate: _1 | Channel One Broadcast
# ==========================================

import sys
import time
import json

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

class OneSystem:
    def __init__(self):
        self.root = 1  # Supreme Root
        self.origin = "Coordinate _1"
        self.active_nodes = {}
        print(f"[BOOT] Initializing Sovereign System anchored at {self.origin} (Root: {self.root})")

    def spawn_node(self, cube_id):
        if cube_id not in self.active_nodes:
            node = {
                "cube_id": cube_id,
                "coordinate": self.origin,
                "rx_state": 0,  # Birth state (Rx = 0)
                "status": "Active"
            }
            self.active_nodes[cube_id] = node
            print(f"[ENGINE] Node spawned: {cube_id} | Initial Rx: 0")
        return self.active_nodes[cube_id]

    # --- 3-6-9 HARMONIC PACING ENGINE ---
    def harmonic_pulse(self, harmonic_level=3):
        """
        Applies a 3-6-9 rhythmic frequency delay/pulse before physical execution.
        Levels: 3 (Micro-Pulse), 6 (Harmonic Wave), 9 (Universal Resonance)
        """
        delay = harmonic_level * 0.1  # Scaled timing factor
        print(f"[3-6-9 HARMONIC] Resonating at Level {harmonic_level} (Pacing sync active)...")
        time.sleep(delay)

    def trigger_current_pulse(self):
        print("[PHYSICAL ACTION] [⚡] Digital command translated to Current! Relay CLOSED. Power pulse pushed to output terminals.")

    # --- NATIVE ONE LANGUAGE PARSER (Multi-Cube & Rx & Harmonic) ---
    def execute_language(self, token_string):
        """
        Parses native One Language syntax with Multi-Cube targeting and 3-6-9 Pacing.
        Syntax Format: _1::TARGET_CUBE::FUNNEL_ID::HARMONIC_LEVEL::Rx_ACTION::COMMAND
        Example:       _1::ALL::FUNNEL_03::3::Rx_NEXT::TRIGGER_CURRENT
        """
        print(f"\n[ONE LANGUAGE] Parsing live token: '{token_string}'")
        
        parts = token_string.split("::")
        root_sig = parts[0]
        
        if root_sig == "_1" or root_sig == str(self.root):
            target_cube = parts[1] if len(parts) > 1 else "ALL"
            funnel = parts[2] if len(parts) > 2 else "FUNNEL_DEFAULT"
            harmonic_lvl = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 3
            rx_action = parts[4] if len(parts) > 4 else "Rx_HOLD"
            command = parts[5] if len(parts) > 5 else "IDLE"
            
            # Apply 3-6-9 Harmonic Pacing before processing
            self.harmonic_pulse(harmonic_lvl)

            # Determine target nodes (Single Cube or All Active Nodes)
            targets = []
            if target_cube == "ALL":
                targets = list(self.active_nodes.keys())
            elif target_cube in self.active_nodes:
                targets = [target_cube]
            else:
                print(f"[ERROR] Target node '{target_cube}' not found. Spawn it first.")
                return {"status": "ERROR", "reason": f"Node {target_cube} not found"}

            # Execute across targeted nodes
            for cid in targets:
                node = self.active_nodes[cid]
                if rx_action == "Rx_NEXT":
                    node["rx_state"] += 1
                
                current_rx = node["rx_state"]
                print(f"[NODE SYNC] Cube: {cid} | Funnel: {funnel} | Rx State: Rx_{current_rx} | Action: {command}")
                
                if command == "TRIGGER_CURRENT":
                    self.trigger_current_pulse()
            
            return {"status": "SUCCESS", "targets": targets}
        else:
            print("[ERROR] Invalid root signature or syntax. Execution rejected.")
            return {"status": "ERROR"}

    def display_status(self):
        print("\n--- ACTIVE NETWORK NODES STATE ---")
        if not self.active_nodes:
            print("No active cubes found in the network.")
        for cid, node in self.active_nodes.items():
            print(f"Node: {cid:<15} | Coordinate: {node['coordinate']} | Rx State: Rx_{node['rx_state']} | Status: {node['status']}")
        print("-" * 34)

# ==========================================
# SYSTEM EXECUTION & INTERACTIVE SHELL
# ==========================================
if __name__ == "__main__":
    print("==========================================")
    print("   CUBiO MULTI-CUBE + 3-6-9 HARMONIC RUNTIME ")
    print("==========================================\n")

    system = OneSystem()

    # Default initial cubes in the network
    system.spawn_node("Cube_Alpha_01")
    system.spawn_node("Cube_Beta_02")

    print("\n==========================================")
    print("      CUBiO LIVE INTERACTIVE SHELL        ")
    print("==========================================\n")
    print("Syntax Guide:")
    print("  _1::CUBE_ID::FUNNEL_ID::HARMONIC(3/6/9)::Rx_ACTION::COMMAND")
    print("  (Use 'ALL' as CUBE_ID to broadcast to all cubes simultaneously)\n")
    print("Commands:")
    print("  SPAWN::<cube_name>  - Create a new physical cube node")
    print("  STATUS              - View all active network nodes")
    print("  EXIT                - Close Channel One stream\n")

    is_interactive = sys.stdin.isatty()
    while True:
        try:
            if is_interactive:
                user_input = input("ONE-LANG >> ").strip()
            else:
                line = sys.stdin.readline()
                if not line:
                    break
                user_input = line.strip()
                if not user_input:
                    continue
                print(f"ONE-LANG >> {user_input}")
            
            if user_input.upper() == "EXIT":
                print("[CHANNEL ONE] Closing stream. System entering deep standby at Coordinate _1.")
                break
            
            if user_input.upper() == "STATUS":
                system.display_status()
                continue
                
            if user_input.upper().startswith("SPAWN::"):
                new_id = user_input.split("::")[1]
                system.spawn_node(new_id)
                print(f"[SUCCESS] Network node '{new_id}' successfully spawned and synced.")
                continue
            
            if user_input:
                system.execute_language(user_input)
                print("-" * 50)
                
        except (KeyboardInterrupt, EOFError):
            print("\n[SYSTEM] Broadcast interrupted safely.")
            break
