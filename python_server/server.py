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

if __name__ == "__main__":
    # Default to stdio if asked, else run directly (stdio is fine for this demo)
    if len(sys.argv) > 1 and sys.argv[1] == "stdio":
        mcp.run()
    else:
        mcp.run()
