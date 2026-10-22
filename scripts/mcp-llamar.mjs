/**
 * Llama una herramienta del servidor MCP de la plataforma, igual que lo haría
 * Claude: levanta mcp/server.mjs por stdio y le pasa los argumentos.
 *
 *   VOLTAC_API_URL=http://localhost:3001 VOLTAC_API_TOKEN=vin_… \
 *     node scripts/mcp-llamar.mjs <herramienta> <archivo.json | '{"json":…}'>
 *
 * Imprime el resultado en JSON. Sale con código 1 si la herramienta falla.
 */
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [herramienta, entrada = "{}"] = process.argv.slice(2);
if (!herramienta) {
  console.error("Uso: node scripts/mcp-llamar.mjs <herramienta> <archivo.json | json>");
  process.exit(2);
}
const args = JSON.parse(fs.existsSync(entrada) ? fs.readFileSync(entrada, "utf8") : entrada);

const client = new Client({ name: "mcp-llamar", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["mcp/server.mjs"], env: { ...process.env } }));
const r = await client.callTool({ name: herramienta, arguments: args });
await client.close();

const texto = r.content?.[0]?.text ?? "";
console.log(texto);
if (r.isError) process.exit(1);
