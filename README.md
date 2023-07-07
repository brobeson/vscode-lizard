# VS Code Lizard

[![Static Analysis](https://github.com/brobeson/vscode-lizard/actions/workflows/static_analysis.yaml/badge.svg)](https://github.com/brobeson/vscode-lizard/actions/workflows/static_analysis.yaml)
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

See the [user manual](https://brobeson.github.io/vscode-lizard/) for information
about the extension's settings.

## Commands

See the [user manual](https://brobeson.github.io/vscode-lizard/) for information
about available commands.

## Known Issues

[![GitHub issues by-label](https://img.shields.io/github/issues/brobeson/vscode-lizard/bug?label=Bugs)](https://github.com/brobeson/vscode-lizard/issues?q=is%3Aopen+is%3Aissue+label%3Abug)
[![GitHub issues by-label](https://img.shields.io/github/issues/brobeson/vscode-lizard/enhancement?label=Feature%20Requests)](https://github.com/brobeson/vscode-lizard/issues?q=is%3Aopen+is%3Aissue+label%3Aenhancement)

- VS Code Lizard cannot scan a file during editing. Lizard reads the file from
  disk, so you must save your changes which triggers scanning the file.
- VS Code Lizard only supports C++. I will add support for other languages as
  soon as possible.
