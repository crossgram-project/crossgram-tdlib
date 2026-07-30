import { describe, expect, it } from "vitest";

import {
  crossgramTdlibOption,
  databaseNamespace,
  parseServerConfiguration,
  serializeServerConfiguration,
  tdlibServerOptionRequest,
} from "../src/config.js";

const rsaKey = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g
5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO
62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/
+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9
t6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs
5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB
-----END RSA PUBLIC KEY-----`;

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Local Crossgram",
    enable_special_config: false,
    host: "127.0.0.1",
    port: 4430,
    rsa_key: rsaKey,
    ...overrides,
  };
}

describe("server configuration", () => {
  it("normalizes missing datacenters and creates a stable identifier", () => {
    const first = parseServerConfiguration(base({
      dcs: [{ id: 2, ip: "127.0.0.2", port: 8443 }],
    }));
    const second = parseServerConfiguration(JSON.stringify(base({
      dcs: [{ id: 2, ip: "127.0.0.2", port: 8443 }],
    })));

    expect(first.id).toMatch(/^crossgram-[0-9a-f]{16}$/);
    expect(first.id).toBe(second.id);
    expect(first.dcs).toEqual([
      { id: 1, ip: "127.0.0.1", port: 4430 },
      { id: 2, ip: "127.0.0.2", port: 8443 },
      { id: 3, ip: "127.0.0.1", port: 4430 },
      { id: 4, ip: "127.0.0.1", port: 4430 },
      { id: 5, ip: "127.0.0.1", port: 4430 },
    ]);
    expect(databaseNamespace(first)).toHaveLength(20);
  });

  it("preserves explicit ids and produces the standard TDLib request", () => {
    const config = parseServerConfiguration(base({ id: "office-qq" }));
    const request = tdlibServerOptionRequest(config);

    expect(config.id).toBe("office-qq");
    expect(request).toEqual({
      "@type": "setOption",
      name: crossgramTdlibOption,
      value: {
        "@type": "optionValueString",
        value: serializeServerConfiguration(config),
      },
    });
  });

  it("defaults special config to enabled for compatibility", () => {
    const config = parseServerConfiguration(base({ enable_special_config: undefined }));
    expect(config.enable_special_config).toBe(true);
  });

  it.each([
    ["hostnames", base({ host: "example.com" }), /IPv4 or IPv6/],
    ["invalid ports", base({ port: 70000 }), /between 1 and 65535/],
    ["invalid PEM", base({ rsa_key: "not a key" }), /PKCS#1/],
    [
      "duplicate datacenters",
      base({ dcs: [
        { id: 1, ip: "127.0.0.1", port: 4430 },
        { id: 1, ip: "127.0.0.2", port: 4430 },
      ] }),
      /duplicate id/,
    ],
  ])("rejects %s", (_name, value, pattern) => {
    expect(() => parseServerConfiguration(value)).toThrow(pattern as RegExp);
  });
});
