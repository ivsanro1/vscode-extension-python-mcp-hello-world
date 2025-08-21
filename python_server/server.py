#!/usr/bin/env python3
"""
Minimal FastMCP Python server exposing a single `greet` tool.
Run in stdio mode when called with argument `stdio`.
"""
from mcp.server.fastmcp import FastMCP
import sys

mcp = FastMCP("MCP Demo Server")

@mcp.tool()
def greet(name: str = "World") -> str:
    """Return a friendly greeting"""
    return f"Hello, {name}! From Python MCP."

if __name__ == "__main__":
    # Default to stdio if asked, else run directly (stdio is fine for this demo)
    if len(sys.argv) > 1 and sys.argv[1] == "stdio":
        mcp.run()
    else:
        mcp.run()
