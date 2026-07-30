# Crossgram TDLib patcher

`crossgram-tdlib` adds instance-scoped Crossgram server selection to upstream
[TDLib](https://github.com/tdlib/td) without changing `td_api.tl` or regenerating
client bindings. It is the shared native layer for Crossgram clients based on
Unigram, Telegram X, Mithka, and other TDLib frontends.

The patch introduces the standard TDLib option
`x_crossgram_server_configuration`. Existing bindings already support
`setOption`, so C#, Java/Kotlin, Dart FFI, and other clients use the same request.

## Safety properties

- Configuration is per TDLib client/database, not process-global.
- The option is accepted only before TDLib parameters are initialized.
- Custom RSA keys and DC addresses are validated natively.
- A malformed persisted custom configuration fails closed; TDLib does not fall
  back to Telegram production RSA keys or built-in DCs.
- Cached DC options from another server are ignored while custom configuration
  is active.
- Telegram DNS/Firebase/Azure simple-config recovery is disabled when
  `enable_special_config` is `false`.

## Server configuration

The input schema matches Crossgram Android and Desktop:

```json
{
  "id": "office-qq",
  "name": "Office Crossgram",
  "enable_special_config": false,
  "host": "192.168.1.100",
  "port": 4430,
  "rsa_key": "-----BEGIN RSA PUBLIC KEY-----\n...\n-----END RSA PUBLIC KEY-----",
  "dcs": [
    { "id": 1, "ip": "192.168.1.100", "port": 4430 }
  ]
}
```

- `host`, every `dcs[].ip`, and ports are validated before networking starts.
- Missing DC IDs 1–5 use the top-level `host` and `port`.
- `enable_special_config` defaults to `true` for compatibility.
- The TypeScript helper creates a deterministic `id` when it is omitted.

## Client integration contract

When TDLib reports `authorizationStateWaitTdlibParameters`:

1. Parse and normalize the user JSON with `parseServerConfiguration`.
2. Choose a database directory namespaced by `databaseNamespace(config)`.
   Never reuse an official Telegram database or a different server's database.
3. Send `tdlibServerOptionRequest(config)` and wait for `ok`.
4. Send `setTdlibParameters`.

To return to official Telegram, send an empty option value before parameters and
use a separate official database directory. Changing servers requires closing
and recreating the TDLib client.

Raw tdjson request example:

```json
{
  "@type": "setOption",
  "name": "x_crossgram_server_configuration",
  "value": {
    "@type": "optionValueString",
    "value": "{...normalized server JSON...}"
  }
}
```

## Patch upstream TDLib

Requires Node.js 22+ (CI uses Node.js 24).

```bash
corepack enable
yarn install --immutable
yarn patch:source --source /path/to/td
yarn check
CROSSGRAM_TDLIB_SOURCE=/path/to/td yarn e2e:source
```

The patch is semantic and idempotent. It installs the native implementation and
tests, updates TDLib's CMake source lists, validates the pre-auth option, and
connects it to RSA selection, default DC selection, cached config isolation, and
special-config recovery.

## Native verification

The check workflow patches a fresh upstream checkout, builds `tdjson` and
TDLib's `run_all_tests`, then runs only the native `CrossgramServerConfig` tests.
This complements the TypeScript unit tests and real-source patch E2E.

## License

MIT. Patched upstream TDLib remains under its original Boost Software License.
