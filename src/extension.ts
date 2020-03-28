import * as vscode from 'vscode';
import { analyze_active_document, Limits, analyze_whole_project } from './lizard';

export function activate(context: vscode.ExtensionContext) {
  let subscriptions = context.subscriptions;
  let diagnostics = vscode.languages.createDiagnosticCollection('Lizard');
  subscriptions.push(diagnostics);
  let log_channel = vscode.window.createOutputChannel('Lizard');
  subscriptions.push(log_channel);

  const limits = read_limits();

  async function lizard_active_document() {
    if (vscode.window.activeTextEditor === undefined) {
      return;
    }
    const diag = await analyze_active_document(limits, log_channel);
    if (diag.document) {
      diagnostics.set(diag.document.uri, diag.diagnostics);
    }
  }

  async function lizard_whole_project() {
    await analyze_whole_project(limits, log_channel);
  }
  // subscriptions.push(vscode.workspace.onDidOpenTextDocument(lizard_active_document));

  context.subscriptions.push(
    vscode.commands.registerCommand("extension.runLizard",
      lizard_active_document));

  lizard_whole_project();
}

// this method is called when your extension is deactivated
export function deactivate() { }

function read_limits(): Limits {
  const configuration = vscode.workspace.getConfiguration("lizard");
  return new Limits(
    configuration.has("limits.ccn") ? configuration.get("limits.ccn") as number : 10,
    configuration.has("limits.length") ? configuration.get("limits.length") as number : 50,
    configuration.has("limits.parameters") ? configuration.get("limits.parameters") as number : 5);
}