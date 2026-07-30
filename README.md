# Crossgram TDLib patcher

`crossgram-tdlib` adds instance-scoped Crossgram server selection and direct
bridge-media downloads to upstream [TDLib](https://github.com/tdlib/td). The
server option does not change `td_api.tl`, so existing client bindings keep
working; the native patch extends the internal MTProto schema for direct media.
It is the shared layer for Unigram, Telegram X, Mithka, and other TDLib clients.

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

## Direct bridge-media downloads

When a custom Crossgram server returns a document or photo whose file reference
is `bridge-media:<positive-id>`, TDLib resolves `crossgram.getFileUrl` on the
same DC. A valid response contains an unexpired HTTP(S) URL and range support:

```json
{
  "url": "https://cdn.example/media/signed-token",
  "expiresAt": 1780000000000,
  "supportsRange": true
}
```

TDLib requests each file part with `Accept-Encoding: identity` and an exact
HTTP `Range` header. It accepts only `206 Partial Content` with a matching
`Content-Range`. RPC failure, malformed or expired metadata, timeout, HTTP
failure, or invalid range data disables direct mode for that file download and
retries the same part through the original `upload.getFile` relay path.
Generated `m` photo previews remain on the relay because they are not the
original bridge media. Decisions are logged as
`crossgram_download_transport=direct|relay`.

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
tests, updates TDLib's CMake source lists and internal MTProto schema, validates
the pre-auth option, connects it to RSA/DC/config isolation, and integrates
direct HTTP Range downloads into `FileDownloader`.

## Native verification

The check workflow patches a fresh upstream checkout and builds `tdjson` plus
TDLib's `run_all_tests`. Native Crossgram tests cover server validation, direct
candidate recognition, URL metadata, and exact range validation. This
complements the TypeScript tests and real-source patch E2E while the full build
verifies generated `crossgram.getFileUrl` bindings and downloader integration.

## License

MIT. Patched upstream TDLib remains under its original Boost Software License.
