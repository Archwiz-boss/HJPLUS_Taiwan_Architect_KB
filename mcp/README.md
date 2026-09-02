# tw-architect-kb-mcp

MCP server for the [台灣建築師知識庫](https://h30190.github.io/HJPLUS_Taiwan_Architect_KB/).

Lets an AI agent search the knowledge base and pull entry text on demand,
instead of cloning the repo and walking `index.md` four levels deep.

同一份工具有兩種跑法：**本機 stdio**（`npx`）與 **Cloudflare Worker**（貼一個
URL）。兩者共用 [`src/server.js`](src/server.js)，只有 transport 不同。

## 架構

GitHub Pages 是純靜態託管，無法執行 MCP 需要的 JSON-RPC 端點 —— 所以
**server 不跑在 github.io 上**，Pages 只當資料層：

```
你 push 內容到 main
  └─ GitHub Action 重建 Pages，重產 docs/kb.json（90 筆、gzip 約 30 KB）
       └─ server（本機或 Worker）啟動時抓一次索引
            └─ 檢索在記憶體完成；需要全文才即時抓 raw.githubusercontent
```

索引直接消費 `scripts/kb_index.py` 既有的產物，不改 `raw/`、不動 OKF 結構、
不新增建置步驟 —— OKF frontmatter 的紀律本身就是這個 server 的檢索語料。

全文刻意**不打包進索引**：需要哪篇才抓哪篇，取回的永遠是 main 的最新版本，
連快取失效問題都一併消失。

## 安裝

### 方式一：本機（開發者）

```json
{
  "mcpServers": {
    "tw-architect-kb": {
      "command": "npx",
      "args": ["-y", "@hjplus/tw-architect-kb-mcp"]
    }
  }
}
```

存檔後重啟 client。不需要 clone repo、不需要 Python、不需要開任何 port。

### 方式二：Cloudflare Worker（免安裝）

```bash
npm run deploy
```

使用者端只要一個 URL，不需要 Node：

```json
{
  "mcpServers": {
    "tw-architect-kb": { "url": "https://<你的 worker 網址>/mcp" }
  }
}
```

Worker 跑在邊緣，對 GitHub Pages 的請求量從「每人每小時一次」收斂成
「每邊緣節點每小時一次」。

## 為什麼 Worker 不需要 Durable Objects

Streamable HTTP 可以在沒有 session 的情況下運作：客戶端身分隨每個請求的
`_meta` 一起送出，不需要 initialize 往返。沒有 session 要存，就不需要
Durable Object，純 Worker 即可服務（`createMcpHandler`，即已 deprecated 的
`McpAgent` 的後繼 —— 後者才需要 Durable Object）。

### 協議版本

| | 版本 |
| --- | --- |
| 官方 spec 最新版 | `2026-07-28` |
| SDK 2.0.0 `SUPPORTED_PROTOCOL_VERSIONS` | `2025-11-25` 起，往下到 `2024-10-07` |
| **本 server 實際協商** | **`2025-11-25`** |

也就是說：我們用的是 **SDK 能提供的最新協議**，但還不是 spec 的最新版 ——
`2026-07-28` 尚未進到 npm 上的 SDK。等 SDK 跟上，升級只是改 `package.json`
的版本號，tool 定義不受影響。

一個實測發現的陷阱：SDK **不驗證** `_meta` 裡的協議版本字串，宣告
`2099-01-01` 也會照樣得到正常回應。所以不要用「請求沒被拒絕」來推論協議版本，
要看 `initialize` 回傳的 `protocolVersion`。

`serveStdio` 與 `createMcpHandler` 接受同樣形狀的 factory，所以 tool 定義能
完整共用。舊的 2025 世代 client 由 `serveStdio` 的相容路徑接住，升級 SDK
不會把人擋在門外。

> **自訂網域注意**：host 驗證（DNS rebinding 防護）預設已涵蓋 localhost 與
> `*.workers.dev`。若綁自訂網域，要在 `createMcpHandler` 補
> `allowedHostnames: [...]`，否則請求會被拒絕。

## Tools

| Tool | 用途 |
| --- | --- |
| `search_kb` | 自然語言檢索，回傳最相關條目與其 `name`。支援中文與法規條號（`§162`、`第33條`），可用 `klass` / `category` / `region` / `verifiedOnly` 篩選 |
| `get_skill` | 依 `name` 取回 `SKILL.md` 全文，可選 `includeDomain` 一併取回 `domain.md` |
| `list_domains` | 列出分類結構與各分類的條目數、查證情況 |

典型流程是 `search_kb` 找到條目 → 取其 `name` → `get_skill` 取回全文。

### 查證狀態

本庫多數條目尚未經人工查證（見網站的「資料狀況」）。建築法規的判斷有實務責任，
所以每筆結果都會標示查證狀態，server instructions 也要求模型不得將未查證內容
陳述為定論。這是刻意的設計，不要為了輸出簡潔而拿掉。

## 檢索作法

中文查詢沒有空白可切，「陽臺容積」無從分詞，因此 CJK 連續段一律切成**字元
bigram** —— 不需要詞典，遇到知識庫沒收錄過的詞也不會整個失效。

bigram 本身很吵（`建築`、`如何` 幾乎命中所有條目），所以每個 term 依 **IDF**
加權，讓填充詞自然沉底，不必維護停用詞表，知識庫長大時也會自動適應。

法規條號另有正規化：`第162條` / `§162` / `Article 162` 一律收斂成 `#162`，
因為各條目的描述會沿用原始法規的寫法。條號精確命中權重最高 —— 那正是實務上
問問題的方式。

## 環境變數

| 變數 | 預設 | 用途 |
| --- | --- | --- |
| `TW_ARCH_KB_INDEX_URL` | Pages 上的 `kb.json` | 指向自架或分支的索引 |
| `TW_ARCH_KB_RAW_BASE` | `raw.githubusercontent.com/.../main/` | 取全文的基底 URL |
| `TW_ARCH_KB_TTL_MS` | `3600000`（1 小時） | 索引快取時間 |

索引更新失敗時會沿用既有快取而非報錯 —— 過期的索引遠好過沒有索引，而索引的
變動速度也慢到過期資料通常仍然正確。

## 開發

```bash
npm install

# 檢索品質：先在 repo 根目錄產生本機索引
python ../scripts/kb_index.py
npm run smoke

npm run e2e          # stdio：實際起 server 打三個 tool（需要網路）
npm run test:worker  # Worker：以 Request 直接驅動 fetch handler
npm run dev          # 在真實 workerd runtime 上跑
```

`smoke` 印出實務型查詢的排序結果供人工檢視 —— 中文 bigram 評分好不好，要看
真實問題有沒有把對的條目排第一，這是斷言測不出來的。

`test:worker` 在 Node 裡驅動 Worker 進入點，不需要 Cloudflare 帳號。真正要
確認 runtime 相容性時用 `npm run dev`（workerd）。

> 在 Windows 用 `curl` 手動打中文查詢時，請把 payload 寫成 UTF-8 檔案再以
> `--data-binary @file` 送出。直接在命令列帶中文會被 shell 轉碼，查詢字串
> 到達 server 時已經壞掉，看起來像檢索失準，其實不是。

## 授權

Apache-2.0（程式碼）。知識庫內容為 CC-BY-SA-4.0，見 repo 根目錄的 `LICENSE`。
