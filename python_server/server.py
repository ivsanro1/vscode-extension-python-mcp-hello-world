#!/usr/bin/env python3
"""
Minimal FastMCP Python server exposing tools via FastMCP.
Includes:
- greet: simple greeting
- generate_story: short story via MCP sampling
Run in stdio mode when called with argument `stdio`.
"""
from mcp.server.fastmcp import FastMCP, Context
from mcp.server.session import ServerSession
from mcp.types import SamplingMessage, TextContent
from pathlib import Path
import json
import sys

mcp = FastMCP("MCP Demo Server")

@mcp.tool()
def greet(name: str = "World") -> str:
    """Return a friendly greeting"""
    return f"Hello, {name}! From Python MCP."


@mcp.tool()
async def generate_story(
    ctx: Context[ServerSession, None],
    topic: str = "a helpful AI assistant",
    style: str = "concise",
) -> str:
    """Generate a short story using LLM sampling (via client-side model).

    The client must implement sampling/createMessage to fulfill this.
    """
    prompt = (
        f"Write a very short {style} story (5-8 sentences) about {topic}. "
        "Be clear and engaging."
    )
    result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content=TextContent(type="text", text=prompt),
            )
        ],
        max_tokens=500,
    )

    if getattr(result, "content", None) and result.content.type == "text":
        return result.content.text
    return str(getattr(result, "content", result))


@mcp.tool(name="query_html")
async def query_html(
    ctx: Context[ServerSession, None],
    html_path: str,
    query: str,
) -> str:
    """Answer questions about a local HTML file.

    Parameters:
      html_path: Path on disk to an HTML file. The file content is read locally; **do not** pass file contents via arguments.
      query: Natural language question or instruction. Some examples:
        - Given an input data schema in JSON/Item class source code/Natural language ( ... ), what target values would be extracted and how? Give a detailed analysis on how each attribute could be extracted from a point of view of implementing the Page Object that extracts the data, indicating selectors and different sources from the html, for me to be able to code all the fallbacks.
        - For the attribute `price`, explain selector strategy.
        - List key interactive elements and their identifiers.
        - Recommend to the user some data schema that would extract the main information from this page
        - Indicate to the user what's some interesting insightful data that can be extracted from this page

    The server will read the HTML (size-limited) and use client-side sampling to have the model answer. The raw model response (text) is returned.
    """
    path = Path(html_path)
    if not path.exists() or not path.is_file():
        return f"File not found: {html_path}"
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:  # pragma: no cover - defensive
        return f"Failed to read HTML file: {e}"

    system_instructions = (
        "You are an expert in web scraping and page object modeling. "
        "Given an HTML snippet and a user query, provide a concise, actionable answer. "
        "When discussing extraction strategies, prefer robust selectors (ids, data-* attributes) and fallback paths. "
        "If asked about mapping a data schema, output a table-like mapping (field -> selector/extraction notes) where helpful. "
    )
    context_snippet_header = ""
    # We wrap HTML in triple backticks to delimit clearly.
    prompt = (
        f"{system_instructions}\n\n"
        f"User Query:\n{query}\n\n"
        f"HTML Content (may be truncated):\n```html\n{context_snippet_header}{raw}\n```\n\n"
        "Answer:\n"
    )

    result = await ctx.session.create_message(
        messages=[
            SamplingMessage(
                role="user",
                content=TextContent(type="text", text=prompt),
            )
        ],
    max_tokens=100_000,
    )

    if getattr(result, "content", None) and result.content.type == "text":
        return result.content.text
    return str(getattr(result, "content", result))

if __name__ == "__main__":
    # Default to stdio if asked, else run directly (stdio is fine for this demo)
    if len(sys.argv) > 1 and sys.argv[1] == "stdio":
        mcp.run()
    else:
        mcp.run()
