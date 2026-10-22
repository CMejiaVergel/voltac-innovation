/**
 * Prueba de humo del canal MCP v2: levanta mcp/server.mjs por stdio, lista las
 * herramientas y llama ver_embudo.
 *
 *   VOLTAC_API_URL=http://localhost:3001 VOLTAC_API_TOKEN=vin_… node scripts/probar-mcp-v2.mjs <slug>
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const slug = process.argv[2];
const client = new Client({ name: "prueba-v2", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: ["mcp/server.mjs"],
    env: { ...process.env },
  }),
);

const { tools } = await client.listTools();
console.log(`herramientas: ${tools.length} (v2: ${tools.filter((t) => t.description?.startsWith("v2 ·")).length})`);

if (slug) {
  const r = await client.callTool({ name: "ver_embudo", arguments: { slug } });
  const datos = JSON.parse(r.content[0].text);
  console.log(`ver_embudo → ${datos.proyecto} · ${datos.postits} post-its · ${datos.conceptos.length} conceptos`);
}
await client.close();
