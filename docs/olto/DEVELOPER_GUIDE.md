# OLTO Frontend Developer Guide
**The Sovereign, Zero-Dependency Reactive Frontend Technology for ONE Language**
*Version 1.0.0 — Production Release*

---

## 1. Introduction & Philosophy

**OLTO** is a native frontend technology inside the ONE Language ecosystem. It replaces traditional multi-file HTML, CSS, and JavaScript boilerplate with a single, expressive, AI-native declarative language.

### Core Architectural Principles:
1. **Zero-Dependency Architecture:** Applications compile into self-contained bundles. No `node_modules`, no external CDN script tags, no framework runtimes required at execution time.
2. **Fine-Grained Signal Reactivity:** Updates bypass the Virtual DOM entirely. Mutating a `Signal` directly updates the corresponding DOM node in **~0.6–0.7 microseconds**, eliminating expensive tree reconciliation.
3. **AI-Native Grammar:** Designed from the ground up for LLMs, autonomous agents, and **ECHO-1** (ONE Language's embedded offline AI). Clean single-file constructs prevent bracket hallucinations, style collisions, and component registration bugs.
4. **Security by Default:** Client-side secrets are strictly prohibited. Compiler invariant `E9001` halts compilation if sensitive tokens (e.g., Stripe secret keys, database credentials) are detected in client state.

---

## 2. Language Syntax & Structure

An OLTO source file (`.olto`) declares either a reusable `component` or a top-level `page`.

```olto
component Counter(initialValue: Number = 0) {
    // 1. Reactive State Signals
    state count: Number = initialValue
    state step: Number = 1

    // 2. Computed Properties (Read-Only Reactive Values)
    computed isPositive: Boolean = {
        return count > 0
    }

    // 3. Actions / Event Handlers
    action increment() {
        count += step
    }

    action decrement() {
        count -= step
    }

    // 4. Declarative Layout Tree
    view {
        Card(padding: 24, radius: 16) {
            Text("OLTO Counter", size: 22, weight: "bold", marginBottom: 12)

            Row(align: "center", gap: 16, marginBottom: 16) {
                Button(label: "-", variant: "outline", onClick: { decrement })
                Text("\(count)", size: 32, weight: "bold")
                Button(label: "+", variant: "outline", onClick: { increment })
            }

            if isPositive {
                Badge(label: "Positive Value", variant: "success")
            }
        }
    }
}
```

---

## 3. Standard UI Component Library

OLTO includes 12 universal, responsive UI components with built-in dark/light theme support:

| Component | Purpose | Key Attributes |
| :--- | :--- | :--- |
| `Container` | Responsive content wrapper | `maxWidth`, `padding`, `background`, `align` |
| `Row` | Horizontal flex layout | `justify`, `align`, `gap`, `wrap`, `marginBottom` |
| `Column` | Vertical flex layout | `justify`, `align`, `gap`, `marginBottom` |
| `Grid` | Responsive multi-column layout | `columns`, `gap`, `marginBottom` |
| `Text` | Typography and reactive text | `size`, `weight`, `color`, `marginBottom`, `align` |
| `Button` | Interactive push button | `label`, `variant` (`primary`, `outline`, `ghost`, `danger`), `onClick`, `disabled` |
| `Input` | Text input control | `placeholder`, `type`, `value`, `onChange`, `marginBottom` |
| `Card` | Elevated surface card | `padding`, `radius`, `elevation`, `border` |
| `Modal` | Overlay dialog container | `isOpen`, `title`, `onClose` |
| `Image` | Optimized image rendering | `src`, `alt`, `width`, `height`, `radius` |
| `Badge` | Status tags and chips | `label`, `variant` (`success`, `warning`, `danger`, `info`), `color` |
| `LoadingSpinner` | Animated activity indicator | `message`, `size`, `color` |
| `Spacer` | Fixed dimension layout spacing | `size` |
| `Toast` | Transient popup notification | `Toast.show(message, type: "success" | "error")` |

---

## 4. Backend & External Service Integration

OLTO connects cleanly to backend sovereign `.one` services and external REST/WebSocket APIs.

### 4.1 Reactive HTTP Client (`OltoClient`)
```typescript
// Continuous reactive data binding
const { data, loading, error, refetch } = OltoClient.useFetch('/api/courses');

// Imperative API calls
await OltoClient.post('/api/checkout', { items: cart });
```

### 4.2 Sovereign ONE Service Bridge (`OneServiceBridge`)
Direct IPC/RPC between OLTO frontend and backend `.one` sovereign services:
```typescript
// Calling backend service method
const res = await OneServiceBridge.call('Academy', 'enroll', { studentId: '369' });

// Reactive service hook
const { data, loading } = OneServiceBridge.useService('Telemetry', 'getStats');
```

---

## 5. Developer CLI Workflows

ONE Language CLI provides complete end-to-end management for OLTO:

```bash
# 1. Validate syntax and security rules
one olto check MyComponent.olto

# 2. Compile to standalone zero-dependency HTML application
one olto build MyComponent.olto --out dist/app.html --theme dark

# 3. Launch live-reload development server (auto-recompile on save)
one olto dev MyComponent.olto --port 3000

# 4. Generate application from natural language using ECHO-1 AI
one olto ai "Build a course-selling academy with cart and checkout" --out Academy.olto
```

---

## 6. Diagnostic Error Codes & Self-Healing Loop

| Error Code | Name | Description & Automatic Fix |
| :--- | :--- | :--- |
| `E9001` | `ClientSecretExposureViolation` | Server secret detected in client state. Auto-repair purges secret from client and suggests backend `.one` service placement. |
| `E9002` | `UnrecognizedComponentError` | Unknown tag or HTML element used. Auto-repair maps to standard OLTO component (e.g. `Box` -> `Container`, `Btn` -> `Button`). |
| `E9003` | `InvalidStateMutationError` | Illegal mutation of read-only `computed` property. Auto-repair removes mutation. |
| `E9004` | `StateCollisionError` | Duplicate identifier declared in same component scope. |
| `E9005` | `UnsupportedDirectiveError` | Low-level or unsupported directive used in frontend scope. |

---

## 7. IDE & VS Code Integration

- **Language Registration:** `.olto` files are automatically detected with full syntax highlighting.
- **Code Snippets:** Type `olto-comp`, `olto-page`, `olto-state`, or `olto-action` for instant scaffolding.
- **ECHO-1 Panel:** Press `Ctrl+Shift+I` in VS Code to ask questions, scaffold UI components, or explain compiler errors.
