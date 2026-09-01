#!/usr/bin/env node
/**
 * MCP server for the Taiwan Architect Knowledge Base.
 *
 * Runs on the user's machine as a stdio subprocess. Its only backend is the
 * OKF index published to GitHub Pages, so there is no service to deploy or
 * operate — see ../README.md for the architecture.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { config, fetchText, findEntry, getIndex } from "./kb.js";
import { search } from "./search.js";

const REPO = "https://github.com/h30190/HJPLUS_Taiwan_Architect_KB";

// Most of the base is not human-verified yet (the 資料狀況 dashboard tracks
// this). Building-code answers carry real professional liability, so every
// result states its verification state rather than letting the model present
// unverified material as settled.
function stateNote(entry) {
  if (entry.verified) {
    const by = entry.verifiedBy?.join(", ") || "未具名";
    return `已查證（${by}${entry.verifiedAt ? `，${entry.verifiedAt}` : ""}）`;
  }
  return `${entry.stateLabel || "狀態未標示"} — 需自行核對法規原文`;
}

function formatHit(entry, score) {
  const lines = [
    `### ${entry.title}`,
    `- \`name\`: \`${entry.name}\`（用於 get_skill）`,
    `- 分類：${entry.breadcrumb?.join(" / ") || entry.category || "—"}`,
    `- 類別：${entry.klassLabel || entry.klass || "—"}`,
    `- 查證狀態：${stateNote(entry)}`,
  ];
  if (entry.regulation) lines.push(`- 法規：${entry.regulation}`);
  if (entry.dataCurrency) lines.push(`- 資料時效：${entry.dataCurrency}`);
  if (entry.isPlanned) lines.push(`- ⚠️ 此條目為籌備中，內容尚未撰寫`);
  if (entry.hasTodo) lines.push(`- ⚠️ 標記為待台灣適配（TODO）`);
  lines.push(`- 說明：${entry.description || entry.summary || "—"}`);
  lines.push(`- 原文：${entry.skillUrl || `${REPO}/blob/main/${entry.skillPath}`}`);
  if (score) lines.push(`- 相關度：${score.toFixed(1)}`);
  return lines.join("\n");
}

function text(s) {
  return { content: [{ type: "text", text: s }] };
}

function fail(err) {
  return {
    isError: true,
    content: [{ type: "text", text: `查詢失敗：${err.message}` }],
  };
}

const server = new McpServer(
  { name: "tw-architect-kb", version: "0.1.0" },
  {
    instructions: [
      "台灣建築師知識庫（OKF bundle）的檢索介面。",
      "",
      "用法：先以 search_kb 找到相關條目，取得其 `name`，再用 get_skill 取回全文。",
      "list_domains 可瀏覽分類結構。",
      "",
      "重要：本庫多數條目尚未經人工查證。回答涉及法規判斷時，必須向使用者",
      "說明條目的查證狀態，並提醒核對法規原文；不要將未查證內容陳述為定論。",
    ].join("\n"),
  },
);

server.registerTool(
  "search_kb",
  {
    title: "檢索知識庫",
    description:
      "以自然語言檢索台灣建築師知識庫，回傳最相關的條目及其 `name`。" +
      "支援中文查詢與法規條號（例如「陽臺容積計算」、「§162」、「第33條 樓梯寬度」）。" +
      "可用 klass / category / region / verifiedOnly 縮小範圍。",
    inputSchema: {
      query: z
        .string()
        .describe("查詢字串，中文或英文皆可；可含法規條號如 §162 或 第33條"),
      klass: z
        .enum(["A", "B", "C"])
        .optional()
        .describe("類別篩選：A 通用技能、B 待台灣適配、C 台灣法規"),
      category: z.string().optional().describe("分類名稱篩選，如「建築法規」"),
      region: z.string().optional().describe("地區篩選，如 taiwan"),
      verifiedOnly: z
        .boolean()
        .optional()
        .describe("僅回傳已經人工查證的條目"),
      limit: z.number().int().min(1).max(20).optional().describe("回傳筆數，預設 5"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ query, klass, category, region, verifiedOnly, limit = 5 }) => {
    try {
      const { entries } = await getIndex();
      const hits = search(entries, query, { klass, category, region, verifiedOnly });
      if (!hits.length) {
        return text(
          `找不到符合「${query}」的條目。可試著放寬關鍵字，或用 list_domains 瀏覽分類。`,
        );
      }
      const shown = hits.slice(0, limit);
      const header = `找到 ${hits.length} 筆，顯示前 ${shown.length} 筆：`;
      return text(
        [header, ...shown.map((h) => formatHit(h.entry, h.score))].join("\n\n"),
      );
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "get_skill",
  {
    title: "取回條目全文",
    description:
      "依 `name` 取回條目的 SKILL.md 全文（即時抓取 main 最新版）。" +
      "可加 includeDomain 一併取回該條目的 domain.md 知識說明。",
    inputSchema: {
      name: z.string().describe("條目的 `name`，由 search_kb 取得"),
      includeDomain: z
        .boolean()
        .optional()
        .describe("是否一併回傳 domain.md（知識背景說明），預設 false"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ name, includeDomain = false }) => {
    try {
      const entry = await findEntry(name);
      if (!entry) {
        return text(`找不到 name 為「${name}」的條目。請先用 search_kb 確認正確的 name。`);
      }
      if (entry.isPlanned) {
        return text(
          `「${entry.title}」目前標記為籌備中，尚無內容。\n分類：${entry.breadcrumb?.join(" / ")}`,
        );
      }

      const parts = [
        `# ${entry.title}`,
        `查證狀態：${stateNote(entry)}`,
        `原文：${entry.skillUrl || `${REPO}/blob/main/${entry.skillPath}`}`,
      ];

      if (includeDomain && entry.domainPath) {
        const domain = await fetchText(entry.domainPath);
        parts.push("---", "## domain.md", domain);
      }
      const skill = await fetchText(entry.skillPath);
      parts.push("---", "## SKILL.md", skill);

      return text(parts.join("\n\n"));
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "list_domains",
  {
    title: "瀏覽分類結構",
    description:
      "列出知識庫的所有分類、各分類條目數與查證情況，用於在不確定關鍵字時瀏覽。",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async () => {
    try {
      const index = await getIndex();
      const { summary } = index;
      const rows = Object.entries(summary?.categories || {})
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, s]) => {
          const flags = [];
          if (s.verified) flags.push(`已查證 ${s.verified}`);
          if (s.todo) flags.push(`待適配 ${s.todo}`);
          if (s.planned) flags.push(`籌備中 ${s.planned}`);
          return `| ${name} | ${s.total} | ${flags.join("、") || "—"} |`;
        });

      return text(
        [
          `知識庫共 ${summary?.total ?? index.entries.length} 筆條目（OKF v${index.okfVersion || "0.2"}）。`,
          "",
          "| 分類 | 條目數 | 備註 |",
          "| --- | --- | --- |",
          ...rows,
          "",
          `索引來源：${config.indexUrl}`,
        ].join("\n"),
      );
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
