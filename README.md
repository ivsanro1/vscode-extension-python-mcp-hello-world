# VS Code extension - MCP Tool Demo

This repo is a minimal VS Code extension that shows how to expose a local MCP server launched with the extension, by using `lm.registerTool`.

MCP is implemented as a Python MCP server (FastMCP) communicating over stdio.

This has been tested only for VSCode Insiders `1.104.0`, which has the new `lm.registerTool` API.


# Screenshots

<img width="1513" height="844" alt="image" src="https://github.com/user-attachments/assets/52289f6e-73c1-466e-9e28-d27b52bdc057" />


# Details

Highlights:
- Contributes a `languageModelTools` entry with `canBeReferencedInPrompt: true` so it’s discoverable and usable via `#mcp-greet`.
- Registers the tool at runtime with `vscode.lm.registerTool`.
- Bridges requests to a Python FastMCP server implemented in `python_server/server.py`.

## Prerequisites
- Node.js 18+
- Python 3.10+
- VS Code 1.103+

Important: Ensure the Python environment you intend to run is active and has the MCP package installed.

```bash
# In your chosen Python env (e.g., venv/conda)
pip install "mcp[cli]"
```

## Install & Build
```bash
cd /path/to/this/extension
npm install
npm run build
```

## Running in VS Code
1) Open this folder in VS Code, press F5 to launch an Extension Development Host.
2) Ensure a Python interpreter with MCP is available
3) Use the tool in Chat or inline chat (you can just ask the agent to explicitly greet you and your name)
