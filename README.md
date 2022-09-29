# VS Code Lizard

[![Build and Test](https://github.com/brobeson/vscode-lizard/actions/workflows/main.yaml/badge.svg)](https://github.com/brobeson/vscode-lizard/actions/workflows/main.yaml)

This is an extension for Visual Studio Code to run
[Lizard](https://github.com/terryyin/lizard) cyclomatic complexity analysis on
your project.

## Features

This extension reports diagnostics for functions that:

- are too long,
- have too many parameters, or
- have too many branches.

You can enable the metrics and specify their limits in your VS Code settings.

## Requirements

VS Code Lizard runs Lizard under the hood and processes the results. You must
[install Lizard](https://github.com/terryyin/lizard#installation) on your
system.

## Extension Settings

- `lizard.ccn`: The maximum modified cyclomatic complexity of a function. Set
  this 0 to disable scanning CCN. The default value is 0.
- `lizard.parameters`: The maximum number of parameters for a function. Set this
  to 0 to disable scanning function parameters. The default value is 0.
- `lizard.length`: The maximum length of a function. Set this to 0 to disable
  scanning function length. The default value is 0.
- `lizard.modified_ccn`: Use modified CCN analysis. This treats switch
  statements as complexity 1 regardless of the number of cases. The default is
  off.
- `lizard.whitelist`: The path to a whitelist file. The path is relative to the
  workspace. See the Lizard documentation for details.
- `lizard.extensions`: A list of Lizard extensions to run as part of the Lizard
  command. See the Lizard documentation for details.

## Commands

- `Lizard: Scan the Current Document`: Use this command manually scan the
  current file with Lizard. Note that VS Code Lizard scans a file automatically
  when you save it, and when you update the settings. This command is most
  useful when you make an external change, such as editing the whitelist file.

## Known Issues

[![GitHub issues by-label](https://img.shields.io/github/issues/brobeson/vscode-lizard/bug?label=Bugs)](https://github.com/brobeson/vscode-lizard/issues?q=is%3Aopen+is%3Aissue+label%3Abug)
[![GitHub issues by-label](https://img.shields.io/github/issues/brobeson/vscode-lizard/enhancement?label=Feature%20Requests)](https://github.com/brobeson/vscode-lizard/issues?q=is%3Aopen+is%3Aissue+label%3Aenhancement)

- VS Code Lizard cannot scan a file during editing. Lizard reads the file from
  disk, so you must save your changes which triggers scanning the file.
- VS Code Lizard only supports C++. I will add support for other languages as
  soon as possible.
