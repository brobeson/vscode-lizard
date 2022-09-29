import { spawn } from "child_process";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  let subscriptions = context.subscriptions;
  let diagnostics = vscode.languages.createDiagnosticCollection("Lizard");
  subscriptions.push(diagnostics);
  let log = vscode.window.createOutputChannel("Lizard");
  subscriptions.push(log);

  // async function lizardDocument(file: vscode.TextDocument) {
  //   if (vscode.workspace.workspaceFolders === undefined) {
  //     return;
  //   }
  //   const diag = await lintDocument(
  //     file,
  //     vscode.workspace.workspaceFolders[0].uri.fsPath,
  //     limits,
  //     log
  //   );
  //   diagnostics.set(file.uri, diag);
  // }

  async function lizardActiveDocument() {
    if (
      vscode.window.activeTextEditor !== undefined &&
      vscode.workspace.workspaceFolders !== undefined
    ) {
      diagnostics.set(
        vscode.window.activeTextEditor.document.uri,
        await lintDocument(
          vscode.window.activeTextEditor.document,
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          log
        )
      );
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
      lizardActiveDocument
    )
  );
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(lizardActiveDocument)
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(lizardActiveDocument)
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnostics.delete(doc.uri)
    )
  );
  // context.subscriptions.push(
  //   vscode.workspace.onDidChangeConfiguration((config) => {
  //     if (config.affectsConfiguration("lizard")) {
  //       limits = readLimits();
  //       vscode.workspace.textDocuments.forEach(lizardDocument);
  //     }
  //   })
  // );
}

export function deactivate() {}

export type Configuration = {
  readonly ccn?: number;
  readonly length?: number;
  readonly parameters?: number;
  readonly modified?: boolean;
  readonly whitelist?: string;
  readonly extensions?: string[];
};

export type Details = {
  readonly fullFunctionName: string; // Function name with namespaces.
  readonly functionName: string; // Function name without namespaces.
  readonly lineNumber: number;
  readonly ccn: number;
  readonly length: number;
  readonly parameters: number;
};

async function lintDocument(
  file: vscode.TextDocument,
  workingDirectory: string,
  log: vscode.OutputChannel
) {
  // TODO Expand this list to include all the languages supported by Lizard.
  if (!["cpp"].includes(file.languageId) || file.uri.scheme !== "file") {
    return [];
  }
  const limits = readLimits();
  return createDiagnosticsForAllOutput(
    await runLizard(file.uri.fsPath, workingDirectory, limits, log),
    limits,
    file
  );
}

function readLimits(): Configuration {
  const configuration = vscode.workspace.getConfiguration("lizard");
  return {
    ccn: configuration.get("ccn"),
    length: configuration.get("functionLength"),
    parameters: configuration.get("parameterCount"),
    modified: configuration.get("useModifiedCcn"),
    whitelist: configuration.get("whitelist"),
    extensions: configuration.get("extensions"),
  };
}

function runLizard(
  file: string,
  workingDirectory: string,
  limits: Configuration,
  log: vscode.OutputChannel
): Promise<string> {
  const commandArguments = getLizardCommandArguments(limits, file);
  log.appendLine(`> lizard ${commandArguments.join(" ")}`);
  return new Promise((resolve, reject) => {
    const process = spawn("lizard", commandArguments, {
      cwd: workingDirectory,
    });
    if (process.pid) {
      let output = "";
      process.stdout.on("data", (data) => { output += data; }); // prettier-ignore
      process.stderr.on("data", (data) => { output += data; }); // prettier-ignore
      process.on("close", (code) => {
        log.append(output);
        resolve(output.trim());
      });
      process.on("error", (err) => reject(err));
    } else {
      log.appendLine("Failed to run Lizard.");
    }
  });
}

function getLizardCommandArguments(limits: Configuration, file?: string) {
  let commandArguments: string[] = ["--warnings_only"];
  if (limits.modified) {
    commandArguments.push("--modified");
  }
  if (limits.ccn) {
    commandArguments.push(`--CCN=${limits.ccn}`);
  }
  if (limits.length) {
    commandArguments.push(`--length=${limits.length}`);
  }
  if (limits.parameters) {
    commandArguments.push(`--arguments=${limits.parameters}`);
  }
  if (limits.whitelist && limits.whitelist !== "") {
    commandArguments.push(`--whitelist=${limits.whitelist}`);
  }
  if (limits.extensions) {
    for (const extension of limits.extensions) {
      if (extension !== "") {
        commandArguments.push(`--extension=${extension}`);
      }
    }
  }
  if (file) {
    commandArguments.push(file);
  }
  return commandArguments;
}

function createDiagnosticsForAllOutput(
  processOutput: string,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  let diagnostics: vscode.Diagnostic[] = [];
  processOutput
    .trim()
    .split("\n")
    .forEach(
      (line) =>
        (diagnostics = diagnostics.concat(processLine(line, limits, file)))
    );
  return diagnostics;
}

function processLine(
  line: string,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  if (line.startsWith("WARNING") && !line.endsWith("!!!!!")) {
    const warning = line.replace("WARNING: ", "");
    vscode.window.showWarningMessage(
      warning.charAt(0).toUpperCase() + warning.slice(1)
    );
    return [];
  }
  return createDiagnosticsForOneLine(extractDetails(line), limits, file);
}

function extractDetails(line: string): Details | null {
  const matches = line.match(
    /(^[^:]+):(\d+):[^:]+: (.+) has \d+ NLOC, (\d+) CCN, \d+ token, (\d+) PARAM, (\d+) length/
  );
  if (matches && matches.length >= 7) {
    return {
      // For C++ overloaded operators, Lizard inserts spaces into the function
      // name. For example, 'operator[]' becomes 'operator [ ]'. That messes up
      // function name searching later, so remove any spaces in the function
      // name.
      fullFunctionName: matches[3].replaceAll(" ", ""),
      functionName: extractFunctionName(matches[3].replaceAll(" ", "")),
      lineNumber: parseInt(matches[2]) - 1,
      ccn: parseInt(matches[4]),
      length: parseInt(matches[6]),
      parameters: parseInt(matches[5]),
    };
  }
  vscode.window.showWarningMessage(`Failed to parse '${line}`);
  return null;
}

function extractFunctionName(fullFunctionName: string): string {
  if (fullFunctionName === "*global*") {
    return fullFunctionName;
  }
  const index = fullFunctionName.lastIndexOf(":");
  if (index === undefined) {
    return fullFunctionName;
  }
  return fullFunctionName.substring(index + 1);
}

function createDiagnosticsForOneLine(
  details: Details | null,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  const diagnostics: vscode.Diagnostic[] = [];
  if (details) {
    if (limits.ccn && limits.ccn > 0 && details.ccn > limits.ccn) {
      diagnostics.push(createCcnDiagnostic(details, file, limits.ccn));
    }
    if (limits.length && limits.length > 0 && details.length > limits.length) {
      diagnostics.push(createLengthDiagnostic(details, file, limits.length));
    }
    if (
      limits.parameters &&
      limits.parameters > 0 &&
      details.parameters > limits.parameters
    ) {
      diagnostics.push(
        createParametersDiagnostic(details, file, limits.parameters)
      );
    }
  }
  return diagnostics;
}

function createCcnDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  const d = createDiagnostic(details, file);
  d.message =
    details.functionName === "*global*"
      ? `The global scope has ${details.ccn} CCN; the maximum is ${limit}.`
      : `${details.functionName} has ${details.ccn} CCN; the maximum is ${limit}.`;
  d.code = "CCN";
  return d;
}

function createLengthDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  const d = createDiagnostic(details, file);
  d.message =
    details.functionName === "*global*"
      ? `The global scope has ${details.length} lines; the maximum is ${limit}.`
      : `${details.functionName} has ${details.length} lines; the maximum is ${limit}.`;
  d.code = "Function Length";
  return d;
}

function createParametersDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  const d = createDiagnostic(details, file);
  d.message =
    details.functionName === "*global*"
      ? `The global scope has ${details.parameters} parameters; the maximum is ${limit}.`
      : `${details.functionName} has ${details.parameters} parameters; the maximum is ${limit}.`;
  d.code = "Parameter Count";
  return d;
}

function createDiagnostic(details: Details, file: vscode.TextDocument) {
  let d = new vscode.Diagnostic(
    details.functionName === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : getFunctionRange(details, file),
    "dummy message",
    vscode.DiagnosticSeverity.Warning
  );
  d.source = "Lizard";
  return d;
}

function getFunctionRange(
  details: Details,
  file: vscode.TextDocument
): vscode.Range {
  const lineText = file.lineAt(details.lineNumber).text;
  const startCharacter = lineText.lastIndexOf(details.functionName);
  if (startCharacter >= 0) {
    const range = file.getWordRangeAtPosition(
      new vscode.Position(details.lineNumber, Math.max(startCharacter, 0)),
      // C++ allows operator[] overloading. If that is the offending function,
      // make the [] characters regex literals instead of a character range.
      RegExp(details.functionName.replaceAll("[", "\\[").replaceAll("]", "\\]"))
    );
    if (range) {
      return range;
    }
  }
  // Default case - highlight from the first non-space character to the end of
  // the line.
  return new vscode.Range(
    details.lineNumber,
    lineText.indexOf(lineText.trimStart()),
    details.lineNumber,
    lineText.length
  );
}
