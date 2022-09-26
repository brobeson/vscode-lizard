import { spawn } from "child_process";
import * as vscode from "vscode";

export class Configuration {
  readonly ccn: number;
  readonly length: number;
  readonly arguments: number;
  readonly modified: boolean;
  readonly whitelist: string;
  readonly extensions: string[];
  constructor(
    ccn: number,
    length: number,
    parameters: number,
    modified: boolean,
    whitelist: string,
    extensions: string[]
  ) {
    this.ccn = ccn;
    this.length = length;
    this.arguments = parameters;
    this.modified = modified;
    this.whitelist = whitelist;
    this.extensions = extensions;
  }
}

export async function lintActiveDocument(
  workingDirectory: string,
  limits: Configuration,
  log: vscode.OutputChannel
) {
  if (vscode.window.activeTextEditor === undefined) {
    return { document: undefined, diagnostics: [] };
  }
  return {
    document: vscode.window.activeTextEditor.document,
    diagnostics: await lintDocument(
      vscode.window.activeTextEditor.document,
      workingDirectory,
      limits,
      log
    ),
  };
}

export async function lintDocument(
  file: vscode.TextDocument,
  workingDirectory: string,
  limits: Configuration,
  log: vscode.OutputChannel
) {
  // TODO Expand this list to include all the languages supported by Lizard.
  if (!["cpp"].includes(file.languageId) || file.uri.scheme !== "file") {
    return [];
  }
  return createDiagnosticsForAllOutput(
    await runLizard(file.uri.fsPath, workingDirectory, limits, log),
    limits,
    file
  );
}

function runLizard(
  file: string,
  workingDirectory: string,
  limits: Configuration,
  log: vscode.OutputChannel
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = makeLizardCommand(limits, file);
    const lizard = "lizard";
    log.appendLine(`> ${lizard} ${args.join(" ")}`);
    log.show();

    const process = spawn(lizard, args, {
      cwd: workingDirectory,
    });
    if (process.pid) {
      let stdout = "";
      let stderr = "";
      process.stdout.on("data", (data) => {
        stdout += data;
      });
      process.stdout.on("end", () => {
        log.appendLine(stdout);
        resolve(stdout);
      });
      process.stderr.on("data", (data) => {
        stderr += data;
      });
      process.stderr.on("end", () => {
        if (stderr.length > 0) {
          const exceptionMessage = extractExceptionMessage(stderr);
          vscode.window.showErrorMessage(
            `Lizard failed; here's the exception message:\n${exceptionMessage}`
          );
        }
      });
      process.on("error", (err) => {
        log.appendLine(err.message);
        reject(err);
      });
    } else {
      log.appendLine("Failed to run Lizard.");
    }
  });
}

function extractExceptionMessage(processOutput: string): string {
  const lines = processOutput.trim().split("\n");
  return lines[lines.length - 1];
}

function makeLizardCommand(limits: Configuration, file: string | undefined) {
  let args: string[] = ["--warnings_only"];
  if (limits.modified) {
    args.push("--modified");
  }
  if (limits.ccn !== 0) {
    args.push(`--CCN=${limits.ccn}`);
  }
  if (limits.length !== 0) {
    args.push(`--length=${limits.length}`);
  }
  if (limits.arguments !== 0) {
    args.push(`--arguments=${limits.arguments}`);
  }
  if (limits.whitelist !== "") {
    args.push(`--whitelist=${limits.whitelist}`);
  }
  for (const extension of limits.extensions) {
    args.push(`--extension=${extension}`);
  }
  if (file !== undefined) {
    args.push(file);
  }
  return args;
}

function createDiagnosticsForAllOutput(
  processOutput: string,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  const lines = processOutput.trim().split("\n");
  let diagnostics: vscode.Diagnostic[] = [];
  for (const line of lines) {
    if (line.startsWith("WARNING")) {
      if (!line.endsWith("!!!!!")) {
        const warning = line.replace("WARNING: ", "");
        vscode.window.showWarningMessage(
          warning.charAt(0).toUpperCase() + warning.slice(1)
        );
      }
    } else {
      diagnostics = diagnostics.concat(
        createDiagnosticsForOneLine(extractDetails(line), limits, file)
      );
    }
  }
  for (let diagnostic of diagnostics) {
    diagnostic.source = "Lizard";
  }
  return diagnostics;
}

class Details {
  readonly fullFunctionName: string; // Function name with namespaces.
  readonly functionName: string; // Function name without namespaces.
  readonly lineNumber: number;
  readonly ccn: number;
  readonly length: number;
  readonly arguments: number;
  constructor(
    fullFunctionName: string,
    lineNumber: number,
    ccn: number,
    length: number,
    parameters: number
  ) {
    this.fullFunctionName = fullFunctionName;
    this.functionName = extractFunctionName(fullFunctionName);
    this.lineNumber = lineNumber;
    this.ccn = ccn;
    this.length = length;
    this.arguments = parameters;
  }
}

function extractFunctionName(fullFunctionName: string): string {
  if (fullFunctionName === "*global*") {
    return fullFunctionName;
  }
  const index = fullFunctionName.lastIndexOf(":");
  if (index === undefined) {
    return fullFunctionName;
  }
  return fullFunctionName.substr(index + 1);
}

function createDiagnosticsForOneLine(
  details: Details,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  let diagnostics: vscode.Diagnostic[] = [];
  if (limits.ccn > 0 && details.ccn > limits.ccn) {
    diagnostics.push(createCcnDiagnostic(details, file, limits.ccn));
  }
  if (limits.length > 0 && details.length > limits.length) {
    diagnostics.push(createLengthDiagnostic(details, file, limits.length));
  }
  if (limits.arguments > 0 && details.arguments > limits.arguments) {
    diagnostics.push(
      createParametersDiagnostic(details, file, limits.arguments)
    );
  }
  return diagnostics;
}

function createCcnDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.functionName === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : getFunctionRange(details, file),
    details.functionName === "*global*"
      ? `The global scope has ${details.ccn} CCN; the maximum is ${limit}.`
      : `${details.functionName} has ${details.ccn} CCN; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "CCN";
  return d;
}

function createLengthDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.functionName === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : getFunctionRange(details, file),
    details.functionName === "*global*"
      ? `The global scope has ${details.length} length; the maximum is ${limit}.`
      : `${details.functionName} has ${details.length} length; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "Function Length";
  return d;
}

function createParametersDiagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.functionName === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : getFunctionRange(details, file),
    details.functionName === "*global*"
      ? `The global scope has ${details.arguments} parameters; the maximum is ${limit}.`
      : `${details.functionName} has ${details.arguments} parameters; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "Argument Count";
  return d;
}

function extractDetails(line: string): Details {
  return new Details(
    line.split(" ")[2],
    parseInt(line.split(":")[1]) - 1,
    extractValues(line, /[0-9]+ CCN/),
    extractValues(line, /[0-9]+ length/),
    extractValues(line, /[0-9]+ PARAM/)
  );
}

function getFunctionRange(
  details: Details,
  file: vscode.TextDocument
): vscode.Range {
  const lineText = file.lineAt(details.lineNumber).text;
  const startCharacter = lineText.lastIndexOf(details.functionName);
  if (startCharacter >= lineText.length) {
    return new vscode.Range(details.lineNumber, 0, details.lineNumber, 0);
  }
  const range = file.getWordRangeAtPosition(
    new vscode.Position(details.lineNumber, startCharacter),
    RegExp(details.functionName)
  );
  if (range === undefined) {
    return new vscode.Range(details.lineNumber, 0, details.lineNumber, 0);
  }
  return range;
}

function extractValues(text: string, parameterRegex: RegExp) {
  let matches = text.match(parameterRegex);
  if (matches === null) {
    return 0;
  }
  return parseInt(matches[0].split(" ")[0]);
}
