# VS Code extension - MCP Tool Demo (+ MCP Sampling)

This repo is a minimal VS Code extension that shows how to expose a local MCP server launched with the extension, by using `lm.registerTool`.

MCP is implemented as a Python MCP server (FastMCP) communicating over stdio.

This has been tested only for VSCode Insiders `1.104.0`, which has the new `lm.registerTool` API.

There's also an example of how to do MCP sampling (story tool), to make a completion in MCP server using local LLM from the client VSCode.


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

````markdown
# VS Code extension - MCP Tool Demo (+ MCP Sampling)

This repo is a minimal VS Code extension that shows how to expose a local MCP server launched with the extension, by using `lm.registerTool`.

MCP is implemented as a Python MCP server (FastMCP) communicating over stdio.

Tested with VS Code Insiders `1.104.0`, which has the new `lm.registerTool` API.

There are now multiple example tools:
- `greet`: simple text tool
- `generate_story`: demonstrates MCP sampling (server requests a completion; client fulfills via VS Code model)
- `query_html`: analyze local HTML using sampling


# Screenshots

<img width="1513" height="844" alt="image" src="https://github.com/user-attachments/assets/52289f6e-73c1-466e-9e28-d27b52bdc057" />


# Details

Highlights:
- Contributes `languageModelTools` entries with `canBeReferencedInPrompt: true` so they’re discoverable (`#mcp-greet`, `#mcp-story`, `#mcp-query-html`).
- Registers tools at runtime via `vscode.lm.registerTool`.
- Bridges requests to a Python FastMCP server (`python_server/server.py`).

## Prerequisites
- Node.js 18+
- Python 3.10+
- VS Code 1.103+

Ensure your Python environment has the MCP package installed:

```bash
pip install "mcp[cli]"
```

## Install & Build
```bash
cd /path/to/this/extension
npm install
npm run build
```

## Running in VS Code
1. Open this folder in VS Code, press F5 to launch an Extension Development Host.
2. Ensure a Python interpreter with MCP is available.
3. Use tools in Chat (e.g., `#mcp-greet`).

## Story tool via MCP Sampling
The Python server exposes `generate_story(topic, style)`. The extension fulfills `sampling/createMessage` by delegating to a local VS Code chat model (e.g., Copilot).

Chat example:
```text
Tell me a touching story about Randy Orton and John Cena becoming best friends. Use MCP
```
If you omit inputs, defaults are used.

## New: HTML Query Tool (`query_html` / `#mcp-query-html`)

Answer questions about a local HTML file. The HTML content itself is never sent as a parameter; only the path (`html_path`) and your natural language `query`. The server reads the entire file and uses sampling so an LLM can reason about selectors, data extraction strategies, etc.

Parameters:
- `html_path` (required) Absolute or workspace-relative path to an HTML file.
- `query` (required) Question or instruction. Examples:
	- "Given this JSON schema for a Product ( ... ), map each field to selectors you would use."
	- "For only the price and title fields of the product schema, what selectors would you use?"
	- "List the main navigation links and how to select them."

Behavior:
1. Server reads entire file and builds an expert scraping prompt.
2. Calls `sampling/createMessage` (client supplies model output; high max token limit configured).
3. Returns raw text answer.

Chat usage examples:
```text
Use #mcp-query-html to analyze ./examples/product.html for selectors to extract name, price, and description.
```
Or inline (if supported):
```text
@#mcp-query-html {"html_path": "/abs/path/page.html", "query": "Provide a table mapping product fields (id, title, price) to selectors"}
```

Notes:
- Output is plain text.
- Ensure the path is accessible to the extension host.

## Sampling Model Selection & Preferences

When the MCP Python server requests `sampling/createMessage`, the extension chooses a VS Code chat model using a cascade:

1. Per-request meta field `_meta.preferredModel` (if provided by the server).
2. User setting `mcpDemo.samplingModel` (exact model id). Configure in Settings UI or `settings.json`:
	 ```json
	 {
		 "mcpDemo.samplingModel": "gpt-4.1"
	 }
	 ```
3. Per-request meta array `_meta.preferredFamilies` (e.g. `["gpt-5", "gemini-2.5-pro"]`).
4. User setting `mcpDemo.preferredFamilies` (ordered list) if meta not supplied.
5. Built‑in fallback family list: `gpt-5`, `gemini-2.5-pro`, `gpt-4.1`, `gpt-4o`, `o3`, `gpt-4.1-mini` (first available wins).
6. Generic vendor fallback: first Copilot chat model returned by `selectChatModels`.

Diagnostics: The extension output channel logs a line such as:
```
Sampling model selection -> id(gpt-4.1):SUCCESS:copilot:gpt-4.1
```
or with fallbacks attempted. If no model is found, the request fails with an error listing attempts.

Server-side example including meta hints:
```json
{
	"method": "sampling/createMessage",
	"params": {
		"messages": [ { "role": "user", "content": { "type": "text", "text": "Write a haiku" } } ],
		"_meta": {
	"preferredModel": "gpt-5",
	"preferredFamilies": ["gpt-5", "gemini-2.5-pro", "gpt-4.1"]
		}
	}
}
```

Config examples (`settings.json`):
```jsonc
{
	// Force a single model id
	"mcpDemo.samplingModel": "gpt-5",
	// Or leave samplingModel empty and define ordered families
	"mcpDemo.preferredFamilies": ["gpt-5", "gemini-2.5-pro", "gpt-4.1", "gpt-4o"]
}
```

Leave `mcpDemo.samplingModel` empty to allow dynamic server hints or family ordering. Set it to force a consistent model regardless of server hints. The first available family in the list is chosen.

````

## Testing

The repository includes a lightweight Python test for the MCP server's `query_html` tool so you can validate behavior without launching the VS Code extension.

### What the Test Does
- Imports the server module (`python_server/server.py`).
- Fakes the sampling call by providing a dummy session object whose `create_message` returns a fabricated model answer containing the expected price.
- Invokes `query_html` with `examples/product.html` and asserts that the output string includes `149.99` (the product price present in the HTML) and does not echo raw HTML.

### Rationale
Real sampling would require a live VS Code model runtime or network model. Mocking keeps the test deterministic, fast, and CI-friendly while still exercising file reading and tool logic paths.

### Dependencies
Install dev dependencies inside your virtual environment:
```bash
pip install "mcp[cli]" pytest pytest-asyncio
```
Or install from the consolidated dev requirements file:
```bash
pip install -r requirements-dev.txt
```

### Run Tests
```bash
python -m pytest -q
```
Or run a single test with verbose output:
```bash
python -m pytest -k test_query_html_price_extracted -vv -s
```

#### Combined (Build + Python Unit + Integration)
You can now run all test layers (TypeScript build, Python unit tests, Node integration test) via:
```bash
npm test
```
This executes, in order:
1. `npm run build` (TypeScript compile)
2. `pytest -q` (Python unit tests: mocked sampling)
3. `node tests/integration/query_html_integration.test.mjs` (stdIO MCP integration: mocked sampling handler in JS)

Individual scripts:
```bash
npm run test:python       # Python tests only
npm run test:integration  # Integration test only
```

Warnings you may see about `asyncio` marks indicate optional plugins; current tests mock sampling and are safe.


### Future Enhancements (Optional)
- Add a mock test for the story tool (simulate different sampling messages).
- Snapshot test for selector mapping prompts.
- CI workflow (GitHub Actions) to run tests on push.

