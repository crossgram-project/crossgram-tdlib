import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const crossgramTdlibOption = "x_crossgram_server_configuration";

export interface ServerDc {
  id: number;
  ip: string;
  port: number;
}

export interface ServerConfiguration {
  id: string;
  name: string;
  enable_special_config: boolean;
  host: string;
  port: number;
  rsa_key: string;
  dcs: ServerDc[];
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Server configuration must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function requirePort(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 65535) {
    throw new Error(`${field} must be an integer between 1 and 65535.`);
  }
  return value as number;
}

function requireIp(value: unknown, field: string): string {
  const result = requireString(value, field);
  if (isIP(result) === 0) throw new Error(`${field} must be an IPv4 or IPv6 address.`);
  return result;
}

function canonicalForId(config: Omit<ServerConfiguration, "id" | "name">): string {
  return JSON.stringify({
    enable_special_config: config.enable_special_config,
    host: config.host,
    port: config.port,
    rsa_key: config.rsa_key,
    dcs: [...config.dcs].sort((a, b) => a.id - b.id),
  });
}

export function parseServerConfiguration(input: string | unknown): ServerConfiguration {
  const object = requireObject(typeof input === "string" ? JSON.parse(input) : input);
  const name = requireString(object.name, "name");
  const host = requireIp(object.host, "host");
  const port = requirePort(object.port, "port");
  const rsaKey = requireString(object.rsa_key, "rsa_key");
  if (!rsaKey.startsWith("-----BEGIN RSA PUBLIC KEY-----") ||
      !rsaKey.endsWith("-----END RSA PUBLIC KEY-----")) {
    throw new Error("rsa_key must be a PKCS#1 RSA public key PEM.");
  }
  const enableSpecialConfig = object.enable_special_config === undefined
    ? true
    : object.enable_special_config;
  if (typeof enableSpecialConfig !== "boolean") {
    throw new Error("enable_special_config must be a boolean.");
  }

  const dcs: ServerDc[] = [];
  const ids = new Set<number>();
  if (object.dcs !== undefined) {
    if (!Array.isArray(object.dcs)) throw new Error("dcs must be an array.");
    for (const [index, raw] of object.dcs.entries()) {
      const dc = requireObject(raw);
      if (!Number.isInteger(dc.id) || (dc.id as number) < 1 || (dc.id as number) > 1000) {
        throw new Error(`dcs[${index}].id must be an integer between 1 and 1000.`);
      }
      const id = dc.id as number;
      if (ids.has(id)) throw new Error(`dcs contains duplicate id ${id}.`);
      ids.add(id);
      dcs.push({
        id,
        ip: requireIp(dc.ip, `dcs[${index}].ip`),
        port: requirePort(dc.port, `dcs[${index}].port`),
      });
    }
  }
  for (let id = 1; id <= 5; id += 1) {
    if (!ids.has(id)) dcs.push({ id, ip: host, port });
  }
  dcs.sort((a, b) => a.id - b.id);

  const withoutId = {
    name,
    enable_special_config: enableSpecialConfig,
    host,
    port,
    rsa_key: rsaKey,
    dcs,
  };
  const generatedId = `crossgram-${createHash("sha256")
    .update(canonicalForId(withoutId))
    .digest("hex")
    .slice(0, 16)}`;
  const id = object.id === undefined ? generatedId : requireString(object.id, "id");
  return { id, ...withoutId };
}

export function serializeServerConfiguration(config: ServerConfiguration): string {
  return JSON.stringify(parseServerConfiguration(config));
}

export function tdlibServerOptionRequest(config: ServerConfiguration): Record<string, unknown> {
  return {
    "@type": "setOption",
    name: crossgramTdlibOption,
    value: {
      "@type": "optionValueString",
      value: serializeServerConfiguration(config),
    },
  };
}

export function databaseNamespace(config: ServerConfiguration): string {
  const normalized = parseServerConfiguration(config);
  return createHash("sha256").update(normalized.id).digest("hex").slice(0, 20);
}
