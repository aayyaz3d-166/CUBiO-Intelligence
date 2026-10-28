declare module 'vscode' {
  export interface Disposable {
    dispose(): any;
  }

  export class Uri {
    static file(path: string): Uri;
    readonly fsPath: string;
    toString(): string;
  }

  export class Position {
    constructor(line: number, character: number);
    readonly line: number;
    readonly character: number;
  }

  export class Range {
    constructor(start: Position, end: Position);
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
    readonly start: Position;
    readonly end: Position;
  }

  export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3,
  }

  export class Diagnostic {
    constructor(range: Range, message: string, severity?: DiagnosticSeverity);
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    code?: string | number;
    source?: string;
  }

  export interface DiagnosticCollection extends Disposable {
    readonly name: string;
    set(uri: Uri, diagnostics: Diagnostic[] | undefined): void;
    delete(uri: Uri): void;
    clear(): void;
  }

  export enum CompletionItemKind {
    Text = 0,
    Method = 1,
    Function = 2,
    Constructor = 3,
    Field = 4,
    Variable = 5,
    Class = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Unit = 10,
    Value = 11,
    Enum = 12,
    Keyword = 13,
    Snippet = 14,
    Color = 15,
    File = 16,
    Reference = 17,
    Folder = 18,
    EnumMember = 19,
    Constant = 20,
    Struct = 21,
  }

  export class CompletionItem {
    constructor(label: string, kind?: CompletionItemKind);
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string | MarkdownString;
    insertText?: string;
  }

  export class MarkdownString {
    constructor(value?: string);
    value: string;
    isTrusted?: boolean;
    appendCodeblock(value: string, language?: string): MarkdownString;
    appendMarkdown(value: string): MarkdownString;
  }

  export class Hover {
    constructor(contents: MarkdownString | string | (MarkdownString | string)[], range?: Range);
    contents: (MarkdownString | string)[];
    range?: Range;
  }

  export class Location {
    constructor(uri: Uri, rangeOrPosition: Range | Position);
    uri: Uri;
    range: Range;
  }

  export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
  }

  export class DocumentSymbol {
    constructor(name: string, detail: string, kind: SymbolKind, range: Range, selectionRange: Range);
    name: string;
    detail: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    children: DocumentSymbol[];
  }

  export class TextEdit {
    static replace(range: Range, newText: string): TextEdit;
    static insert(position: Position, newText: string): TextEdit;
    static delete(range: Range): TextEdit;
    constructor(range: Range, newText: string);
    range: Range;
    newText: string;
  }

  export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
    [key: string]: boolean | number | string;
  }

  export interface CancellationToken {
    isCancellationRequested: boolean;
  }

  export interface TextDocument {
    readonly uri: Uri;
    readonly fileName: string;
    readonly languageId: string;
    readonly version: number;
    getText(range?: Range): string;
    lineAt(line: number): { text: string };
  }

  export interface TextDocumentChangeEvent {
    readonly document: TextDocument;
  }

  export interface TextEditor {
    readonly document: TextDocument;
  }

  export interface ExtensionContext {
    subscriptions: Disposable[];
  }

  export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
  }

  export interface StatusBarItem extends Disposable {
    alignment: StatusBarAlignment;
    priority?: number;
    text: string;
    tooltip?: string | MarkdownString;
    color?: string;
    command?: string;
    show(): void;
    hide(): void;
  }

  export interface WorkspaceConfiguration {
    get<T>(section: string): T | undefined;
    get<T>(section: string, defaultValue: T): T;
    has(section: string): boolean;
    update(section: string, value: any, configurationTarget?: boolean): Thenable<void>;
  }

  export namespace languages {
    export function createDiagnosticCollection(name?: string): DiagnosticCollection;
    export function registerCompletionItemProvider(
      selector: string | { language: string },
      provider: {
        provideCompletionItems(
          document: TextDocument,
          position: Position
        ): CompletionItem[] | Thenable<CompletionItem[]>;
      },
      ...triggerCharacters: string[]
    ): Disposable;
    export function registerHoverProvider(
      selector: string | { language: string },
      provider: {
        provideHover(
          document: TextDocument,
          position: Position
        ): Hover | null | undefined | Thenable<Hover | null | undefined>;
      }
    ): Disposable;
    export function registerDefinitionProvider(
      selector: string | { language: string },
      provider: {
        provideDefinition(
          document: TextDocument,
          position: Position
        ): Location | Location[] | null | undefined | Thenable<Location | Location[] | null | undefined>;
      }
    ): Disposable;
    export function registerDocumentSymbolProvider(
      selector: string | { language: string },
      provider: {
        provideDocumentSymbols(
          document: TextDocument,
          token?: CancellationToken
        ): DocumentSymbol[] | Thenable<DocumentSymbol[]>;
      }
    ): Disposable;
    export function registerDocumentFormattingEditProvider(
      selector: string | { language: string },
      provider: {
        provideDocumentFormattingEdits(
          document: TextDocument,
          options: FormattingOptions,
          token?: CancellationToken
        ): TextEdit[] | Thenable<TextEdit[]>;
      }
    ): Disposable;
  }

  export namespace workspace {
    export const textDocuments: readonly TextDocument[];
    export function onDidOpenTextDocument(listener: (document: TextDocument) => any): Disposable;
    export function onDidChangeTextDocument(listener: (event: TextDocumentChangeEvent) => any): Disposable;
    export function onDidCloseTextDocument(listener: (document: TextDocument) => any): Disposable;
    export function onDidSaveTextDocument(listener: (document: TextDocument) => any): Disposable;
    export function getConfiguration(section?: string, scope?: Uri | null): WorkspaceConfiguration;
  }

  export namespace window {
    export let activeTextEditor: TextEditor | undefined;
    export function showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined>;
    export function showQuickPick(items: string[] | Thenable<string[]>, options?: any): Thenable<string | undefined>;
    export function showInputBox(options?: any): Thenable<string | undefined>;
    export function createOutputChannel(name: string): {
      append(value: string): void;
      appendLine(value: string): void;
      show(preserveFocus?: boolean): void;
      clear(): void;
      dispose(): void;
    };
    export function createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
  }

  export namespace commands {
    export function registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
    export function executeCommand<T = unknown>(command: string, ...rest: any[]): Thenable<T | undefined>;
  }
}
