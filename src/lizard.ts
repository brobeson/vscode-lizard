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

export async function lint_active_document(
  working_directory: string,
  limits: Configuration,
  log_channel: vscode.OutputChannel
) {
  if (vscode.window.activeTextEditor === undefined) {
    return { document: undefined, diagnostics: [] };
  }
  return {
    document: vscode.window.activeTextEditor.document,
    diagnostics: await lint_document(
      vscode.window.activeTextEditor.document,
      working_directory,
      limits,
      log_channel
    ),
  };
}

export async function lint_document(
  file: vscode.TextDocument,
  working_directory: string,
  limits: Configuration,
  log_channel: vscode.OutputChannel
) {
  // TODO Expand this list to include all the languages supported by Lizard.
  if (!["cpp"].includes(file.languageId) || file.uri.scheme !== "file") {
    return [];
  }
  return create_diagnostics_for_all_output(
    await run_lizard(file.uri.fsPath, working_directory, limits, log_channel),
    limits,
    file
  );
}

function run_lizard(
  file: string,
  working_directory: string,
  limits: Configuration,
  log_channel: vscode.OutputChannel
): Promise<string> {
  return new Promise((resolve, reject) => {
    const command_arguments = make_lizard_command(limits, file);
    const lizard = "lizard";
    log_channel.appendLine(`> ${lizard} ${command_arguments.join(" ")}`);
    log_channel.show();

    const process = spawn(lizard, command_arguments, {
      cwd: working_directory,
    });
    if (process.pid) {
      let stdout = "";
      let stderr = "";
      process.stdout.on("data", (data) => {
        stdout += data;
      });
      process.stdout.on("end", () => {
        log_channel.appendLine(stdout);
        resolve(stdout);
      });
      process.stderr.on("data", (data) => {
        stderr += data;
      });
      process.stderr.on("end", () => {
        if (stderr.length > 0) {
          const exception_message = extract_exception_message(stderr);
          vscode.window.showErrorMessage(
            `Lizard failed; here's the exception message:\n${exception_message}`
          );
        }
      });
      process.on("error", (err) => {
        log_channel.appendLine(err.message);
        reject(err);
      });
    } else {
      log_channel.appendLine("Failed to run Lizard.");
    }
  });
}

function extract_exception_message(process_output: string): string {
  const lines = process_output.trim().split("\n");
  return lines[lines.length - 1];
}

function make_lizard_command(limits: Configuration, file: string | undefined) {
  let command_arguments: string[] = ["--warnings_only"];
  if (limits.modified) {
    command_arguments.push("--modified");
  }
  if (limits.ccn !== 0) {
    command_arguments.push(`--CCN=${limits.ccn}`);
  }
  if (limits.length !== 0) {
    command_arguments.push(`--length=${limits.length}`);
  }
  if (limits.arguments !== 0) {
    command_arguments.push(`--arguments=${limits.arguments}`);
  }
  if (limits.whitelist !== "") {
    command_arguments.push(`--whitelist=${limits.whitelist}`);
  }
  for (const extension of limits.extensions) {
    command_arguments.push(`--extension=${extension}`);
  }
  if (file !== undefined) {
    command_arguments.push(file);
  }
  return command_arguments;
}

function create_diagnostics_for_all_output(
  process_output: string,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  const lines = process_output.trim().split("\n");
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
        create_diagnostics_for_one_line(extract_details(line), limits, file)
      );
    }
  }
  for (let diagnostic of diagnostics) {
    diagnostic.source = "Lizard";
  }
  return diagnostics;
}

class Details {
  readonly full_function_name: string; // Function name with namespaces.
  readonly function_name: string; // Function name without namespaces.
  readonly line_number: number;
  readonly ccn: number;
  readonly length: number;
  readonly arguments: number;
  constructor(
    full_function_name: string,
    line_number: number,
    ccn: number,
    length: number,
    parameters: number
  ) {
    this.full_function_name = full_function_name;
    this.function_name = extract_function_name(full_function_name);
    this.line_number = line_number;
    this.ccn = ccn;
    this.length = length;
    this.arguments = parameters;
  }
}

function extract_function_name(full_function_name: string): string {
  if (full_function_name === "*global*") {
    return full_function_name;
  }
  const index = full_function_name.lastIndexOf(":");
  if (index === undefined) {
    return full_function_name;
  }
  return full_function_name.substr(index + 1);
}

function create_diagnostics_for_one_line(
  details: Details,
  limits: Configuration,
  file: vscode.TextDocument
): vscode.Diagnostic[] {
  let diagnostics: vscode.Diagnostic[] = [];
  if (limits.ccn > 0 && details.ccn > limits.ccn) {
    diagnostics.push(create_ccn_diagnostic(details, file, limits.ccn));
  }
  if (limits.length > 0 && details.length > limits.length) {
    diagnostics.push(create_length_diagnostic(details, file, limits.length));
  }
  if (limits.arguments > 0 && details.arguments > limits.arguments) {
    diagnostics.push(
      create_parameters_diagnostic(details, file, limits.arguments)
    );
  }
  return diagnostics;
}

function create_ccn_diagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.function_name === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : get_function_range(details, file),
    details.function_name === "*global*"
      ? `The global scope has ${details.ccn} CCN; the maximum is ${limit}.`
      : `${details.function_name} has ${details.ccn} CCN; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "CCN";
  return d;
}

function create_length_diagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.function_name === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : get_function_range(details, file),
    details.function_name === "*global*"
      ? `The global scope has ${details.length} length; the maximum is ${limit}.`
      : `${details.function_name} has ${details.length} length; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "Function Length";
  return d;
}

function create_parameters_diagnostic(
  details: Details,
  file: vscode.TextDocument,
  limit: number
) {
  let d = new vscode.Diagnostic(
    details.function_name === "*global*"
      ? new vscode.Range(0, 0, file.lineCount, 0)
      : get_function_range(details, file),
    details.function_name === "*global*"
      ? `The global scope has ${details.arguments} parameters; the maximum is ${limit}.`
      : `${details.function_name} has ${details.arguments} parameters; the maximum is ${limit}.`,
    vscode.DiagnosticSeverity.Warning
  );
  d.code = "Argument Count";
  return d;
}

function extract_details(line: string): Details {
  return new Details(
    line.split(" ")[2],
    parseInt(line.split(":")[1]) - 1,
    extract_value(line, /[0-9]+ CCN/),
    extract_value(line, /[0-9]+ length/),
    extract_value(line, /[0-9]+ PARAM/)
  );
}

function get_function_range(
  details: Details,
  file: vscode.TextDocument
): vscode.Range {
  const line_text = file.lineAt(details.line_number).text;
  const start_character = line_text.lastIndexOf(details.function_name);
  if (start_character >= line_text.length) {
    return new vscode.Range(details.line_number, 0, details.line_number, 0);
  }
  const range = file.getWordRangeAtPosition(
    new vscode.Position(details.line_number, start_character),
    RegExp(details.function_name)
  );
  if (range === undefined) {
    return new vscode.Range(details.line_number, 0, details.line_number, 0);
  }
  return range;
}

function extract_value(text: string, parameter_regex: RegExp) {
  let matches = text.match(parameter_regex);
  if (matches === null) {
    return 0;
  }
  return parseInt(matches[0].split(" ")[0]);
}
