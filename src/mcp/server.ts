import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools";

const server = new McpServer({
  name: "talentbridge",
  version: "1.0.0",
});

registerTools(server);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: "Use POST for MCP requests" }));
});

app.delete("/mcp", async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({ error: "Session management not supported" }));
});

const PORT = process.env.MCP_PORT || 3333;
app.listen(PORT, () => {
  console.log(`Talentbridge MCP server running on http://localhost:${PORT}/mcp`);
});
