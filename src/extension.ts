import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { z } from 'zod';

let extensionServerPath: string | null = null;

function getServerPath(): string {
  const configured = vscode.workspace.getConfiguration('mcpDemo').get<string>('serverPath')
    || vscode.workspace.getConfiguration().get<string>('mcpDemo.serverPath');
  if (configured && configured.trim()) return configured;
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (ws) return path.join(ws, 'python_server', 'server.py');
  if (extensionServerPath) return extensionServerPath;
  throw new Error('Could not resolve MCP Python server path. Set `mcpDemo.serverPath` in Settings.');
}

class McpClientManager {
  private client: any | null = null;
  private connecting: Promise<void> | null = null;
  private output = vscode.window.createOutputChannel('MCP Tool Demo');

  private pythonCmd(): string {
    const cfg = vscode.workspace.getConfiguration('mcpDemo').get<string>('pythonPath')
      || vscode.workspace.getConfiguration().get<string>('mcpDemo.pythonPath');
    return (cfg && cfg.trim()) || process.env.MCP_PYTHON || 'python3';
  }

  async start(): Promise<void> {
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = this._startInternal();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async _startInternal(): Promise<void> {
    const serverPath = getServerPath();
    const python = this.pythonCmd();
    if (!fs.existsSync(serverPath)) {
      throw new Error(`Server file not found at ${serverPath}`);
    }
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const transport = new StdioClientTransport({ command: python, args: [serverPath, 'stdio'] });
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const client = new Client({ name: 'vscode-mcp-tool-demo', version: '0.0.1', enforceStrictCapabilities: true, debouncedNotificationMethods: ['notifications/roots/list_changed'] });
  // Advertise sampling capability so server can ask us to create messages
  client.registerCapabilities({ sampling: {} });
    try {
      this.output.appendLine(`Starting MCP server:`);
      this.output.appendLine(`  Python: ${python}`);
      this.output.appendLine(`  Script: ${serverPath} (stdio)`);
  await client.connect(transport);
  // Install sampling handler to fulfill server sampling via VS Code LM
  await this.installSamplingHandler(client);
      const tools = await client.listTools();
  const names = new Set<string>(tools.tools.map((t: any) => t.name));
  if (!names.has('greet')) throw new Error('MCP server did not expose a "greet" tool.');
  if (!names.has('generate_story')) this.output.appendLine('Warning: no generate_story tool found.');
      this.client = client;
      this.output.appendLine('MCP server connected.');
    } catch (err: any) {
      try { await client.close(); } catch {}
      const hint = 'Ensure Python has the `mcp` package installed and the server path is correct.';
      const msg = err?.message || String(err);
      this.output.appendLine(`Failed to start MCP server: ${msg}`);
      throw new Error(`${msg} ${hint}`);
    }
  }

  private async installSamplingHandler(client: any) {
  // Define minimal schemas inline to register handler without importing SDK internals
  const TextContentSchema = z.object({ type: z.literal('text'), text: z.string() });
  const SamplingMessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: TextContentSchema });
  const CreateMessageRequestSchema = z.object({ method: z.literal('sampling/createMessage'), params: z.object({ messages: z.array(SamplingMessageSchema), max_tokens: z.number().optional(), _meta: z.any().optional() }).passthrough() });
  const CreateMessageResultSchema = z.object({ role: z.literal('assistant'), content: TextContentSchema, model: z.string().optional(), stopReason: z.string().optional() });
    // Ensure no duplicate
    try { client.assertCanSetRequestHandler('sampling/createMessage'); } catch {}
  client.setRequestHandler(CreateMessageRequestSchema as any, async (req: any): Promise<any> => {
      const messages = req.params.messages || [];
      // Build VS Code chat messages
      const chatMessages: vscode.LanguageModelChatMessage[] = [];
      for (const m of messages) {
        if (m.role === 'user' && m.content?.type === 'text') {
          chatMessages.push(vscode.LanguageModelChatMessage.User([new vscode.LanguageModelTextPart(m.content.text)]));
        } else if (m.role === 'assistant' && m.content?.type === 'text') {
          chatMessages.push(vscode.LanguageModelChatMessage.Assistant([new vscode.LanguageModelTextPart(m.content.text)]));
        }
      }
      const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
      });
      if (!model) {
        throw new Error('No VS Code chat model available for sampling.');
      }
      const resp = await model.sendRequest(chatMessages, { toolMode: vscode.LanguageModelChatToolMode.Auto });
      let text = '';
      for await (const part of resp.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          text += part.value;
        }
      }
  return CreateMessageResultSchema.parse({
        role: 'assistant',
        content: { type: 'text', text },
        model: model.id,
        stopReason: 'endTurn',
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    try { await this.client.close(); } catch {}
    this.client = null;
    this.output.appendLine('MCP server disconnected.');
  }

  async greet(name: string): Promise<string> {
    await this.start();
    try {
      const result: any = await this.client!.callTool({ name: 'greet', arguments: { name } });
      const textPart = (result.content as any[]).find((p: any) => p.type === 'text') as { type: string; text: string } | undefined;
      return textPart?.text ?? JSON.stringify(result.structuredContent ?? result.content);
    } catch (err: any) {
      const msg = err?.message || String(err);
      const closed = /closed/i.test(msg) || err?.code === -32000;
      if (closed) {
        await this.stop();
        await this.start();
        const result: any = await this.client!.callTool({ name: 'greet', arguments: { name } });
        const textPart = (result.content as any[]).find((p: any) => p.type === 'text') as { type: string; text: string } | undefined;
        return textPart?.text ?? JSON.stringify(result.structuredContent ?? result.content);
      }
      throw err;
    }
  }

  async generateStory(topic: string, style: string): Promise<string> {
    await this.start();
    const result: any = await this.client!.callTool({ name: 'generate_story', arguments: { topic, style } });
    const textPart = (result.content as any[]).find((p: any) => p.type === 'text') as { type: string; text: string } | undefined;
    return textPart?.text ?? JSON.stringify(result.structuredContent ?? result.content);
  }
}

let manager: McpClientManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
  // Fallback to the server bundled with the extension when no workspace is open
  extensionServerPath = vscode.Uri.joinPath(context.extensionUri, 'python_server', 'server.py').fsPath;
  manager = new McpClientManager();
  manager.start().catch(err => {
    const msg = err?.message || String(err);
    vscode.window.showWarningMessage(`MCP server not started: ${msg}`);
  });

  const disposable = vscode.lm.registerTool<{ name: string }>('mcp-greet', {
    async invoke(options: vscode.LanguageModelToolInvocationOptions<{ name: string }>, token: vscode.CancellationToken) {
      if (token.isCancellationRequested) {
        // Respect cancellation early
        return new vscode.LanguageModelToolResult([]);
      }
      const name = (options.input as any)?.name ?? 'World';
      const text = await manager!.greet(name);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(text),
      ]);
    },
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<{ name: string }>, token: vscode.CancellationToken): Promise<vscode.PreparedToolInvocation> {
      if (token.isCancellationRequested) {
        return { progressMessage: 'Cancelling greet…' } as vscode.PreparedToolInvocation;
      }
      const name = (options.input as any)?.name ?? 'World';
      return { progressMessage: `Greeting ${name} via MCP...` } as vscode.PreparedToolInvocation;
    }
  });

  const storyTool = vscode.lm.registerTool<{ topic?: string; style?: string }>('mcp-story', {
    async invoke(options: vscode.LanguageModelToolInvocationOptions<{ topic?: string; style?: string }>, token: vscode.CancellationToken) {
      if (token.isCancellationRequested) {
        return new vscode.LanguageModelToolResult([]);
      }
      const topic = (options.input as any)?.topic ?? 'a curious developer learning MCP';
      const style = (options.input as any)?.style ?? 'concise';
      const text = await manager!.generateStory(topic, style);
      return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
    },
    async prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<{ topic?: string; style?: string }>, token: vscode.CancellationToken) {
      if (token.isCancellationRequested) {
        return { progressMessage: 'Cancelling story…' } as vscode.PreparedToolInvocation;
      }
      const topic = (options.input as any)?.topic ?? 'a curious developer learning MCP';
      return { progressMessage: `Generating short story about ${topic}...` } as vscode.PreparedToolInvocation;
    }
  });

  context.subscriptions.push(disposable, storyTool);
}

export async function deactivate() {
  if (manager) await manager.stop();
}
