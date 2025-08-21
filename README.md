# MCP Tool Demo (VS Code)

This repo contains a minimal VS Code extension that exposes a Language Model tool backed by a Python MCP server (FastMCP) communicating over stdio.

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
2) Ensure a Python interpreter with MCP is available:
	- Default command: `python3`
	- Or set `Settings → MCP Tool Demo → Python Path` (`mcpDemo.pythonPath`) to an absolute interpreter path.
	- Alternatively, set environment variable `MCP_PYTHON` to the interpreter path.
3) Ensure the server script path is correct:
	- Default: `${workspaceFolder}/python_server/server.py`
	- Or set `Settings → MCP Tool Demo → Server Path` (`mcpDemo.serverPath`) to an absolute path.
4) Use the tool in Chat or inline chat:
	- Type `#mcp-greet` and provide JSON input like `{ "name": "Ada" }`.

You can watch the "MCP Tool Demo" Output channel for server startup logs and diagnostics.

## Project Structure
- `src/extension.ts`: Registers the `mcp-greet` tool and starts the MCP client.
- `python_server/server.py`: Minimal FastMCP server exposing a `greet` tool.
- `package.json`: Declares `languageModelTools` and configuration settings.

## Configuration Options
- `mcpDemo.pythonPath`: Absolute path to the Python interpreter. If empty, the extension uses `$MCP_PYTHON` or falls back to `python3`.
- `mcpDemo.serverPath`: Absolute path to the Python server script. If empty, defaults to `${workspaceFolder}/python_server/server.py` (or the copy bundled with the extension when no workspace is open).

## Troubleshooting
- “Could not resolve MCP Python server path”: Set `mcpDemo.serverPath` or ensure the default path exists.
- “MCP server did not expose a "greet" tool.”: Confirm `python_server/server.py` is the correct script and the environment has `mcp` installed.
- Import errors: Verify the active Python environment really has `mcp` by running `python3 -c "import mcp; print(mcp.__version__)"` with the same interpreter configured.

## Why MCP in Python env?
This extension spawns the Python server using your interpreter. For it to work, the interpreter must have the MCP package installed. If you switch environments, reinstall `mcp[cli]` there or point `mcpDemo.pythonPath`/`MCP_PYTHON` to that interpreter.
