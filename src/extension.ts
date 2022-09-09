import * as vscode from "vscode";
import { lint_active_document, Configuration, lint_document } from "./lizard";

export function activate(context: vscode.ExtensionContext) {
  let subscriptions = context.subscriptions;
  let diagnostics = vscode.languages.createDiagnosticCollection("Lizard");
  subscriptions.push(diagnostics);
  let log_channel = vscode.window.createOutputChannel("Lizard");
  subscriptions.push(log_channel);

  let limits = read_limits();

  async function lizard_document(file: vscode.TextDocument) {
    if (vscode.workspace.workspaceFolders === undefined) {
      return;
    }
    const diag = await lint_document(
      file,
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      limits,
      log_channel
    );
    diagnostics.set(file.uri, diag);
  }

  async function lizard_active_document() {
    if (
      vscode.window.activeTextEditor === undefined ||
      vscode.workspace.workspaceFolders === undefined
    ) {
      return;
    }
    const diag = await lint_active_document(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      limits,
      log_channel
    );
    if (diag.document) {
      diagnostics.set(diag.document.uri, diag.diagnostics);
    }
  }

  // List of events that can't be used:
  // - onDidChangeTextDocument: Lizard reads the file from disk; it must be saved
  //    first.
  // TODO After implementing whole-project scanning, try to add an event to
  // rescan after the whitelist file is saved.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "lizard.scanActiveFile",
      lizard_active_document
    )
  );
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(lizard_active_document)
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(lizard_active_document)
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnostics.delete(doc.uri)
    )
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((config) => {
      if (config.affectsConfiguration("lizard")) {
        limits = read_limits();
        vscode.workspace.textDocuments.forEach(lizard_document);
      }
    })
  );
}

function read_limits(): Configuration {
  const configuration = vscode.workspace.getConfiguration("lizard");
  return new Configuration(
    configuration.has("ccn") ? (configuration.get("ccn") as number) : 0,
    configuration.has("length") ? (configuration.get("length") as number) : 0,
    configuration.has("arguments")
      ? (configuration.get("arguments") as number)
      : 0,
    configuration.has("modified")
      ? (configuration.get("modified") as boolean)
      : false,
    configuration.has("whitelist")
      ? (configuration.get("whitelist") as string)
      : "",
    configuration.has("extensions")
      ? (configuration.get("extensions") as string[])
      : []
  );
}

export function deactivate() {}
