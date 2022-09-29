<!-- Jekyll and Github Pages process this file into a website. A level -->
<!-- heading is redundant in the produced HTML. -->
<!-- markdownlint-disable MD041 -->

## Getting Started

1. [Install Lizard](https://github.com/terryyin/lizard#installation) on your
   system. The executable must be in your `PATH`.
1. Install the extension through the
   [VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=brobeson.vscode-lizard).
   VS Code activates the extension when you open a C++ file.
1. Configure your projects complexity limits in _settings.json_. VS Code Lizard
   disables the metrics by default. See Extension Settings for details.

## Extension Settings

- `lizard.ccn`: The maximum cyclomatic complexity of a function. Remove this
  setting to disable scanning CCN.
- `lizard.functionLength`: The maximum length of a function. Remove this setting
  to disable scanning function length.
- `lizard.parameterCount`: The maximum number of parameters a function can have.
  Remove this setting to disable scanning function parameters.
- `lizard.useModifiedCcn`: Use modified CCN analysis. This treats switch
  statements as complexity 1 regardless of the number of cases. The default is
  `false`.
- `lizard.whitelist`: The path to a whitelist file. The path is relative to the
  workspace. See the Lizard documentation for details.
- `lizard.extensions`: A list of Lizard extensions to run as part of the Lizard
  command. See the Lizard documentation for details.

## Running Complexity Analysis

VS Code Lizard runs complexity analysis when you save your file. If you need to
manually run Lizard, you can use the command `Lizard: Scan the Current File` in
the VS Code command palette. VS Code Lizard populates the Problems view with any
results. It also attempts to highlight offending functions in the code with
error squiggles.

## Viewing Output

VS Code Lizard creates an output channel named "Lizard". It prints the Lizard
command and output to this channel.

The extension also reports issues as diagnostics in the Problems view. One
function can have up to three diagnostics, one for each metric. VS Code Lizard
breaks up the diagnostics this way so you know exactly what the complexity
problems are with a particular function.

VS Code Lizard attempts to add warning squiggles in the text editor. Lizard only
reports line numbers, so VS Code must try to examine the source code to figure
out the columns that match the function name. Due to this, the squiggles might
not line up exactly with the function, but they should be on the correct line.
