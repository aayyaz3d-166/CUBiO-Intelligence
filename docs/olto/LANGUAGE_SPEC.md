# OLTO Language Formal Specification (v1.0.0)
================================================
**Language:** OLTO Frontend Language (`.olto`)  
**Ecosystem:** ONE Language Architecture  
**Status:** DRAFT SPECIFICATION (Phase 1)  
**Date:** October 30, 2026  

---

## 1. Overview & Design Principles

OLTO is a declarative, reactive, AI-native frontend programming language designed to author modern user interfaces across Web, Desktop, and Embedded platforms without manual reliance on HTML, CSS, and JavaScript.

### Core Tenets:
1. **Single-Grammar Cohesion:** UI structure, responsive layout, reactive state, visual styling, and event handling reside within one unified syntax.
2. **Deterministic Reactivity:** Fine-grained signal-driven state updates. No virtual DOM diffing, no state synchronization loops.
3. **AI Generation Friendliness:** Strict, unambiguous grammar designed for high token predictability, low hallucination rates, and deterministic validation.
4. **ONE Language Interoperability:** Native import of ONE Language data structs, enums, and Qplayer OBI binary channels.
5. **Zero Credential Exposure:** Strict compile-time rejection of sensitive secrets in client-side code.

---

## 2. Lexical Grammar & Tokens

### 2.1 Keywords
```ebnf
keyword_component   = "component" ;
keyword_page        = "page" ;
keyword_view        = "view" ;
keyword_layout      = "layout" ;
keyword_slot        = "slot" ;
keyword_state       = "state" ;
keyword_computed    = "computed" ;
keyword_watch       = "watch" ;
keyword_action      = "action" ;
keyword_on_mount    = "onMount" ;
keyword_on_destroy  = "onDestroy" ;
keyword_if          = "if" ;
keyword_else        = "else" ;
keyword_each        = "each" ;
keyword_in          = "in" ;
keyword_match       = "match" ;
keyword_import      = "import" ;
keyword_export      = "export" ;
keyword_from        = "from" ;
keyword_as          = "as" ;
keyword_return      = "return" ;
keyword_let         = "let" ;
keyword_const       = "const" ;
keyword_await       = "await" ;
keyword_async       = "async" ;
```

### 2.2 Literals and Identifiers
```ebnf
identifier          = [a-zA-Z_] { [a-zA-Z0-9_] } ;
component_name      = [A-Z] { [a-zA-Z0-9_] } ;
type_name           = [A-Z] { [a-zA-Z0-9_] } [ "<" type_name ">" ] ;

integer_literal     = [0-9]+ ;
float_literal       = [0-9]+ "." [0-9]+ ;
string_literal      = '"' { string_char | interpolation } '"' ;
interpolation       = "\(" expression ")" ;
boolean_literal     = "true" | "false" ;
```

---

## 3. Syntactic Grammar (EBNF)

### 3.1 Module Level
```ebnf
olto_module         = { import_statement } { component_declaration | page_declaration } ;

import_statement    = "import" "{" identifier { "," identifier } "}" "from" string_literal ;
```

### 3.2 Component Declaration
```ebnf
component_declaration = "component" component_name "(" [ parameter_list ] ")" "{" 
                        component_body 
                      "}" ;

page_declaration      = "page" component_name "(" [ parameter_list ] ")" [ "route" string_literal ] "{" 
                        component_body 
                      "}" ;

parameter_list        = parameter { "," parameter } ;
parameter             = identifier ":" type_name [ "=" expression ] ;
```

### 3.3 Component Body
```ebnf
component_body        = { state_declaration 
                        | computed_declaration 
                        | watch_declaration 
                        | lifecycle_hook 
                        | action_declaration } 
                        view_block ;

state_declaration     = "state" identifier ":" type_name "=" expression ;
computed_declaration  = "computed" identifier ":" type_name "=" "{" block_statement "}" ;
watch_declaration     = "watch" identifier "{" block_statement "}" ;

lifecycle_hook        = ( "onMount" | "onDestroy" ) "{" block_statement "}" ;
action_declaration   = [ "async" ] "action" identifier "(" [ parameter_list ] ")" "{" block_statement "}" ;
```

### 3.4 View Hierarchy & Layout
```ebnf
view_block            = "view" "{" ui_node "}" ;

ui_node               = element_node 
                      | conditional_node 
                      | iteration_node 
                      | slot_node ;

element_node          = component_name "(" [ attribute_list ] ")" [ "{" { ui_node } "}" ] ;

attribute_list        = attribute { "," attribute } ;
attribute             = identifier ":" ( expression | handler_block ) ;
handler_block         = "{" block_statement "}" ;

conditional_node      = "if" expression "{" { ui_node } "}" [ "else" "{" { ui_node } "}" ] ;
iteration_node        = "each" identifier [ "," identifier ] "in" expression "{" { ui_node } "}" ;
slot_node             = "slot" [ string_literal ] ;
```

---

## 4. Standard Type System

OLTO features a strictly-typed semantic model.

### 4.1 Primitives
* `String`: UTF-8 textual data. Supports interpolation (`"Hello \(name)"`).
* `Number`: 64-bit IEEE double-precision numeric values.
* `Boolean`: `true` or `false`.
* `List<T>`: Strongly-typed dynamic array.
* `Map<K, V>`: Strongly-typed key-value association.
* `Event`: Synthetic event descriptor passed to UI interaction handlers.
* `Void`: Unit return type for actions.

### 4.2 Shared Types from ONE Language
OLTO directly imports backend struct definitions from `.one` files:
```olto
import { UserProfile, OrderStatus } from "backend/models.one"

state currentUser: UserProfile = ...
```
Any type mismatch during compilation triggers diagnostic `E2001: TypeMismatch`.

---

## 5. Reactive Signal Semantics

OLTO does not employ a Virtual DOM. State transitions operate via a **Direct Signal Dependency Graph**:

1. **Signal Registration:** Each `state var: T = value` registers a fine-grained reactive cell.
2. **Dependency Tracking:** During `view` compilation, property bindings subscribe directly to cell update triggers.
3. **Synchronous Micro-Batching:** When state is mutated:
   ```olto
   count += 1
   ```
   The runtime updates only the corresponding DOM text node or attribute directly (`node.textContent = ...`).
4. **Lifecycle Hooks:**
   * `onMount`: Executes synchronously after component enters the DOM tree.
   * `onDestroy`: Executes immediately prior to component DOM disposal (cleans event listeners and intervals).

---

## 6. Built-in Core UI Components

OLTO provides a standard, battery-included component library:

| Component | Category | Key Properties |
| :--- | :--- | :--- |
| `Container` | Layout | `maxWidth`, `padding`, `margin`, `align` |
| `Row` | Layout (Flex) | `justify`, `align`, `gap`, `wrap` |
| `Column` | Layout (Flex) | `justify`, `align`, `gap` |
| `Grid` | Layout (Grid) | `columns`, `gap`, `rowGap` |
| `Text` | Typography | `size`, `weight`, `color`, `maxLines`, `align` |
| `Button` | Interaction | `label`, `variant`, `disabled`, `onClick`, `icon` |
| `Input` | Form | `value`, `placeholder`, `type`, `onInput`, `error` |
| `Card` | Surface | `radius`, `elevation`, `padding`, `color` |
| `Image` | Media | `src`, `width`, `height`, `fit`, `radius` |
| `Badge` | Feedback | `label`, `color`, `icon`, `size` |
| `Modal` | Overlay | `isOpen`, `onClose`, `title`, `width` |
| `LoadingSpinner` | Feedback | `size`, `message`, `color` |

---

## 7. Canonical Reference Examples

### Example 1: Interactive Counter Component
```olto
component Counter(initialValue: Number = 0) {
    state count: Number = initialValue

    view {
        Row(align: "center", gap: 16) {
            Button(label: "-", onClick: { count -= 1 })
            Text("\(count)", size: 24, weight: "bold")
            Button(label: "+", onClick: { count += 1 })
        }
    }
}
```

### Example 2: Dynamic Task List with Validation
```olto
component TodoApp() {
    state todos: List<String> = []
    state newTodoText: String = ""
    state errorMessage: String = ""

    action addTodo() {
        if newTodoText.trim().isEmpty() {
            errorMessage = "Task name cannot be empty."
            return
        }
        todos.push(newTodoText.trim())
        newTodoText = ""
        errorMessage = ""
    }

    action removeTodo(index: Number) {
        todos.removeAt(index)
    }

    view {
        Container(maxWidth: 500, padding: 20) {
            Text("My Tasks", size: 28, weight: "bold", marginBottom: 16)

            Row(gap: 8, marginBottom: 8) {
                Input(
                    value: newTodoText, 
                    placeholder: "Enter new task...", 
                    onInput: { val in newTodoText = val }
                )
                Button(label: "Add", onClick: { addTodo() })
            }

            if !errorMessage.isEmpty() {
                Text(errorMessage, color: "red", size: 12, marginBottom: 8)
            }

            if todos.isEmpty() {
                Text("No tasks yet. Enjoy your day!", color: "gray")
            } else {
                Column(gap: 8) {
                    each todo, i in todos {
                        Card(padding: 12) {
                            Row(justify: "between", align: "center") {
                                Text(todo, size: 16)
                                Button(label: "Delete", variant: "ghost", onClick: { removeTodo(i) })
                            }
                        }
                    }
                }
            }
        }
    }
}
```

---

## 8. Compiler Diagnostic Error Codes

| Code | Name | Description |
| :--- | :--- | :--- |
| `E9001` | `ClientSecretExposureViolation` | Attempted use of secret environment keys or database credentials in client code. |
| `E9002` | `UnrecognizedComponentError` | Referenced component does not exist in scope or standard library. |
| `E9003` | `InvalidStateMutationError` | Attempted to mutate computed property or read-only prop. |
| `E9004` | `MissingRequiredPropError` | Mandatory component prop was not provided in instantiation. |
| `E9005` | `LayoutConstraintViolation` | Conflicting layout directives (e.g. invalid column specs). |
