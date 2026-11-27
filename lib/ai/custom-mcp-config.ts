export type CustomMcpConfig = {
  name: string;
  url: string;
  headers: Record<string, string>;
};

export type CustomMcpServer = CustomMcpConfig & {
  id: string;
  enabled_tools: string[];
};

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseMcpJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("O JSON informado é inválido.");
  }
}

export function validateMcpConfig(name: string, endpoint: string, headers: unknown): CustomMcpConfig {
  name = name.trim();
  if (!name || name.length > 80) throw new Error("Informe um nome de até 80 caracteres.");

  let url: URL;
  try {
    url = new URL(endpoint.trim());
  } catch {
    throw new Error("Informe a URL HTTPS do servidor MCP.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.href.length > 2048)
    throw new Error("Use uma URL HTTPS sem usuário, senha ou fragmento.");

  if (!isJsonObject(headers)) throw new Error("Os cabeçalhos devem ser um objeto JSON.");
  const validated = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== "string" || /\${[^}]+}/.test(value))
      throw new Error("Preencha os cabeçalhos com valores de texto e resolva variáveis como ${TOKEN}.");

    if (
      /^(accept|content-type|cookie2?|host|origin|referer|content-length|connection|transfer-encoding|mcp-.*|proxy-.*|sec-.*)$/i.test(
        key,
      ) ||
      validated.has(key)
    )
      throw new Error("Há um cabeçalho reservado ou duplicado na configuração.");
    try {
      validated.set(key, value);
    } catch {
      throw new Error("Há um cabeçalho inválido na configuração.");
    }
  }
  if (/(?:\$|%24)(?:\{|%7b)/i.test(url.href))
    throw new Error("Preencha as variáveis na URL antes de cadastrar o servidor.");
  const normalized = Object.fromEntries(validated.entries());
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > 6000)
    throw new Error("Os cabeçalhos devem ocupar até 6 KB.");
  return { name, url: url.href, headers: normalized };
}

export function importClaudeMcp(text: string): CustomMcpConfig[] {
  const config = parseMcpJson(text);
  if (!isJsonObject(config) || !isJsonObject(config.mcpServers))
    throw new Error("Cole a configuração .mcp.json com o objeto mcpServers.");

  const servers = Object.entries(config.mcpServers).flatMap(([name, server]) => {
    if (!isJsonObject(server) || !["http", "streamable-http"].includes(String(server.type))) return [];
    if (typeof server.url !== "string") throw new Error("Um servidor HTTP está sem URL.");
    return [validateMcpConfig(name, server.url, server.headers ?? {})];
  });
  if (!servers.length) throw new Error("O arquivo precisa ter um servidor do tipo http.");
  return servers;
}
