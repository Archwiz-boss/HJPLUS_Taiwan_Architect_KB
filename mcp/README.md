# tw-architect-kb-mcp

MCP server for the [台灣建築師知識庫](https://h30190.github.io/HJPLUS_Taiwan_Architect_KB/).

Lets an AI agent search the knowledge base and pull entry text on demand,
instead of cloning the repo and walking `index.md` four levels deep.

## 架構

GitHub Pages 只能託管靜態檔案，無法執行 MCP 需要的 JSON-RPC 端點 —— 所以
**server 不跑在 github.io 上**，而是以 Pages 當資料層、server 跑在使用者本機：

```
你 push 內容到 main
  └─ GitHub Action 重建 Pages，重產 docs/kb.json（90 筆、gzip 約 30 KB）
       └─ 使用者本機的 MCP server 啟動時抓一次索引
            └─ 檢索在本機完成；需要全文才即時抓 raw.githubusercontent
```

這樣**沒有任何伺服器需要部署或維運**，也沒有帳單。使用者端只是在 MCP client
的設定檔加一段 JSON，`npx` 會自動取得並執行。

索引直接消費 `scripts/kb_index.py` 既有的產物，不改 `raw/`、不動 OKF 結構、
不新增建置步驟 —— OKF frontmatter 的紀律本身就是這個 server 的檢索語料。

全文刻意**不打包進索引**：需要哪篇才抓哪篇，取回的永遠是 main 的最新版本，
連快取失效問題都一併消失。

## 安裝

在 MCP client 的設定檔加入：

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

存檔後重啟 client 即可。不需要 clone repo、不需要 Python、不需要開任何 port。

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
node test/smoke.js

# 端對端：實際起 server 打三個 tool（需要網路）
node test/e2e.js
```

`smoke.js` 印出實務型查詢的排序結果供人工檢視 —— 中文 bigram 評分好不好，
要看真實問題有沒有把對的條目排第一，這是斷言測不出來的。

## 授權

Apache-2.0（程式碼）。知識庫內容為 CC-BY-SA-4.0，見 repo 根目錄的 `LICENSE`。
