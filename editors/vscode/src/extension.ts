import * as vscode from 'vscode';
import { OneLanguageServer, LSPCompletionItem } from '../../../src/one/lsp/OneLanguageServer';
import { OneDeveloperCLI } from '../../../src/one/cli/OneDeveloperCLI';

function mapCompletionKind(kind: LSPCompletionItem['kind']): vscode.CompletionItemKind {
  switch (kind) {
    case 'Keyword':
      return vscode.CompletionItemKind.Keyword;
    case 'Function':
      return vscode.CompletionItemKind.Function;
    case 'Variable':
      return vscode.CompletionItemKind.Variable;
    case 'Constant':
      return vscode.CompletionItemKind.Constant;
    case 'Module':
      return vscode.CompletionItemKind.Module;
    default:
      return vscode.CompletionItemKind.Text;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('ONE Language');
  outputChannel.appendLine('[ONE Language Extension] Activated successfully.');

  const lsp = new OneLanguageServer();
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('one');
  context.subscriptions.push(diagnosticCollection);

  const updateDiagnostics = (document: vscode.TextDocument): void => {
    if (document.languageId !== 'one') return;

    try {
      const rawDiagnostics = lsp.getDiagnostics(document.getText());
      const vsDiagnostics: vscode.Diagnostic[] = rawDiagnostics.map((d) => {
        const line = Math.max(0, (d.range.start.line || 1) - 1);
        const col = Math.max(0, (d.range.start.column || 1) - 1);
        const endCol = Math.max(col + 1, (d.range.end.column || col + 2) - 1);

        const range = new vscode.Range(
          new vscode.Position(line, col),
          new vscode.Position(line, endCol)
        );

        const diag = new vscode.Diagnostic(
          range,
          `[${d.code}] ${d.message}`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'ONE Compiler';
        diag.code = d.code;
        return diag;
      });

      diagnosticCollection.set(document.uri, vsDiagnostics);
    } catch (err: any) {
      outputChannel.appendLine(`[Diagnostic Error] ${err.message || err}`);
    }
  };

  // 1. Diagnostics on Document Open / Change / Close
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc))
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => updateDiagnostics(event.document))
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );

  // Validate all currently opened ONE documents
  vscode.workspace.textDocuments.forEach((doc) => updateDiagnostics(doc));

  // 2. Autocomplete / Code Completion Provider
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'one',
      {
        provideCompletionItems(document, position) {
          try {
            const items = lsp.getCompletions(document.getText(), {
              line: position.line + 1,
              column: position.character + 1,
            });

            return items.map((item) => {
              const vsItem = new vscode.CompletionItem(item.label, mapCompletionKind(item.kind));
              vsItem.detail = item.detail;
              vsItem.documentation = item.documentation;
              vsItem.insertText = item.insertText || item.label;
              return vsItem;
            });
          } catch {
            return [];
          }
        },
      },
      '.',
      '@'
    )
  );

  // 3. Hover Information Provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('one', {
      provideHover(document, position) {
        try {
          const hover = lsp.getHover(document.getText(), {
            line: position.line + 1,
            column: position.character + 1,
          });

          if (!hover) return null;

          const contents = hover.contents.map((c) => {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(c);
            return md;
          });

          return new vscode.Hover(contents);
        } catch {
          return null;
        }
      },
    })
  );

  // 4. Go-To-Definition Provider
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider('one', {
      provideDefinition(document, position) {
        try {
          const def = lsp.getDefinition(document.getText(), {
            line: position.line + 1,
            column: position.character + 1,
          });

          if (!def) return null;

          const range = new vscode.Range(
            new vscode.Position(Math.max(0, def.range.start.line - 1), Math.max(0, def.range.start.column - 1)),
            new vscode.Position(Math.max(0, def.range.end.line - 1), Math.max(0, def.range.end.column - 1))
          );

          return new vscode.Location(document.uri, range);
        } catch {
          return null;
        }
      },
    })
  );

  // 5. Developer Commands (Run & Check)
  context.subscriptions.push(
    vscode.commands.registerCommand('one.checkFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'one') {
        vscode.window.showInformationMessage('No active ONE Language document.');
        return;
      }
      updateDiagnostics(editor.document);
      const res = OneDeveloperCLI.run(['check', editor.document.fileName]);
      if (res.exitCode === 0) {
        vscode.window.showInformationMessage('ONE Check: Source is valid!');
      } else {
        outputChannel.show(true);
        outputChannel.appendLine(`[Check Failed]:\n${res.stderr}`);
        vscode.window.showErrorMessage('ONE Check: Static analysis errors found.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('one.runFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== 'one') {
        vscode.window.showInformationMessage('No active ONE Language document.');
        return;
      }

      outputChannel.show(true);
      outputChannel.appendLine(`\n[Executing]: ${editor.document.fileName}...`);
      const res = OneDeveloperCLI.run(['run', editor.document.fileName]);
      if (res.stdout) {
        outputChannel.appendLine(res.stdout);
      }
      if (res.stderr) {
        outputChannel.appendLine(res.stderr);
      }
      outputChannel.appendLine(`[Process finished with exit code ${res.exitCode}]`);
    })
  );
}

export function deactivate(): void {}
