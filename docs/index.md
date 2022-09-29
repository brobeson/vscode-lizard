<!-- Jekyll and Github Pages process this file into a website. A level -->
<!-- heading is redundant in the produced HTML. -->
<!-- markdownlint-disable MD041 -->

## Getting Started

First, [install Lizard](https://github.com/terryyin/lizard#installation) on your
system. The executable must be in your `PATH`. Second, install the extension
through the
[VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=brobeson.vscode-lizard).
VS Code activates the extension when you open a C++ file.

Finally, configure your projects complexity limits in _settings.json_. VS Code
Lizard disables the metrics by default. See Extension Settings for details.

## Running Complexity Analysis

VS Code Lizard runs complexity analysis when you save your file. If you need to
manually run Lizard, you can use the command `Lizard: Scan the Current Document`
in the VS Code command palette. VS Code Lizard populates the Problems view with
any results. It also attempts to highlight offending functions in the code with
error squiggles.

## Extension Settings

- `lizard.ccn`: The maximum cyclomatic complexity of a function. Set this 0 to
  disable scanning CCN. The default value is 0.
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
