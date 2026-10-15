# Crossgram TDLib Patcher

向 [TDLib](https://github.com/tdlib/td) 源码注入按客户端实例隔离的 Crossgram 自定义服务器配置与 `bridge-media:` 直连下载能力。作为 Unigram、Telegram X、Mithka 等 TDLib 客户端的共用底层补丁。

补丁复用 TDLib 标准 `setOption` 接口，新增选项 `x_crossgram_server_configuration`（不改动公开的 `td_api.tl`，兼容现有 C#、Java/Kotlin、Dart FFI 等语言绑定）。

## 安全与隔离特性

- **实例级隔离**：配置绑定在单个 TDLib 客户端/数据库实例上，非进程全局状态。
- **初始化前锁定**：仅允许在 `setTdlibParameters` 初始化前设置，切换服务器需关闭并重建 TDLib 实例。
- **Fail-Closed 校验**：在 C++ 原生层校验 RSA 公钥与 DC 地址；若持久化的自定义配置损坏，直接拒绝连接，绝不静默回退到 Telegram 官方服务器或官方公钥。
- **忽略跨服缓存**：启用自定义服务器时，忽略数据库中缓存的其他服务器 DC 列表；`enable_special_config: false` 时禁用 DNS / Firebase / Azure 备用配置拉取。

## 服务器配置 JSON

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

- 未列出的 DC 1–5 自动使用顶层 `host` 与 `port` 补齐。
- `enable_special_config` 默认为 `true`。
- 省略 `id` 时，辅助函数会根据配置内容生成确定性的哈希 ID。

## 客户端接入顺序

当收到 `authorizationStateWaitTdlibParameters` 时：

1. 使用 `parseServerConfiguration` 校验并规范化 JSON。
2. 按 `databaseNamespace(config)` 选择独立的数据库目录（严禁与官方服务器或其他自定义服务器共用数据库目录）。
3. 发送 `setOption("x_crossgram_server_configuration", ...)`：
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
4. 发送 `setTdlibParameters`。

切回官方 Telegram 服务器时，在 `setTdlibParameters` 前发送 `optionValueEmpty` 并切回官方数据库目录。

## `bridge-media:` 直连下载

当文件或图片的 `file_reference` 匹配 `bridge-media:<正整数>` 时，`FileDownloader` 会先在对应 DC 调用 `crossgram.getFileUrl`：

```json
{
  "url": "https://cdn.example/media/signed-token",
  "expiresAt": 1780000000000,
  "supportsRange": true
}
```

随后通过 HTTP `Range`（`Accept-Encoding: identity`）按分片直接下载并严格校验 `206 Partial Content` 与 `Content-Range`。若 RPC、元数据、HTTP 或字节范围校验失败，当前文件自动回退至原生 `upload.getFile` 中转下载，并在日志中记录 `crossgram_download_transport=direct|relay`。

## 使用与验证

需要 Node.js 22+：

```bash
corepack enable
yarn install --immutable
yarn patch:source --source /path/to/td
yarn check
CROSSGRAM_TDLIB_SOURCE=/path/to/td yarn e2e:source
```

## License

补丁工具采用 MIT 协议；打补丁后的 TDLib 源码仍遵循其原有的 Boost Software License。
