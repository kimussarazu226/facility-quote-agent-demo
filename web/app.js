/** @typedef {{ code: string; description: string; quantity: number; unit: string }} ScopeItem */

/** 事前チャット（テキスト送信が主。ヒントは入力欄下に控えめに表示） */
const PRECHAT_SCRIPT = [
  {
    summaryTitle: "補足",
    agent:
      "<strong>ポートサイド本館（架空）</strong>の一括保守見積を出します。依頼文に足したいことがあれば、自由に書いてください。",
    suggestions: ["特になし", "B1は深夜立入のみ、と一文足したい"],
  },
  {
    summaryTitle: "期限",
    agent: "回答期限は <strong>5/25</strong> のままで進めますか？",
    suggestions: ["そのままでOK", "1週間だけ延ばしたい"],
  },
];

const PRECHAT_SAMPLE_TEXTS = ["特になし", "そのままでOK"];

/** @type {{ title: string; answer: string }[]} */
let prechatAnswers = [];

let prechatBusy = false;

const RFQ = {
  request_id: "RFQ-2026-DEMO-0842",
  facility: {
    name: "ポートサイドSC 本館（架空）",
    address: "神奈川県○○市 ○○町1-1-1",
    floor_area_m2: 12800,
    note: "地上3階＋屋上機械室",
  },
  scope: {
    category: "商業施設 · 設備保守一括（サンプル）",
    items: [
      {
        code: "PAC-INS-26",
        description: "パッケージ空調 定期点検（年4回・48台）",
        quantity: 1,
        unit: "式",
      },
      {
        code: "ELV-FM-26",
        description: "エレベーター 年間保守（制御盤含む・4台）",
        quantity: 4,
        unit: "台",
      },
      {
        code: "FIRE-INS",
        description: "消防用設備 法令点検（施設一式）",
        quantity: 1,
        unit: "式",
      },
      {
        code: "LED-PAT",
        description: "照明・非常灯 月1回巡回点検",
        quantity: 12,
        unit: "月",
      },
    ],
    period: "2026-06-01 〜 2027-05-31",
    notes:
      "深夜帯のみ立入可のゾーンあり（B1物流バックヤード）。緊急対応は平日8:00–20:00を想定。既存NDA雛形に準拠（架空）。",
  },
  contact: {
    company: "テスト商事株式会社 施設管理部（架空）",
    email: "demo-facilities@example.ne.jp",
    phone: "044-000-0000",
  },
  due_date: "2026-05-25",
};

const VENDORS = [
  {
    vendor_id: "vendor-alpha",
    display_name: "中央設備メンテナンス株式会社（架空）",
    channel_label: "メール（添付PDF想定）",
  },
  {
    vendor_id: "vendor-beta",
    display_name: "ベイエリアFMサービス合同会社（架空）",
    channel_label: "メール（Excel見積想定）",
  },
  {
    vendor_id: "ion-delight-style",
    display_name: "グリーンビルテック株式会社（統合FM・架空）",
    channel_label: "協力会社ポータル（イメージ）",
  },
];

const MOCK_QUOTES = [
  {
    vendor_id: "vendor-alpha",
    display_name: "中央設備メンテナンス株式会社（架空）",
    valid_until: "2026-06-12",
    start_note: "契約締結の翌月1日から",
    lines: [
      { label: "空調定期点検（48台・年4回）", unit_price_yen: 1_850_000, quantity: 1 },
      { label: "エレベータ年間保守（1台あたり）", unit_price_yen: 520_000, quantity: 4 },
      { label: "消防法令点検", unit_price_yen: 380_000, quantity: 1 },
      { label: "照明・非常灯巡回（月1）", unit_price_yen: 68_000, quantity: 12 },
    ],
  },
  {
    vendor_id: "vendor-beta",
    display_name: "ベイエリアFMサービス合同会社（架空）",
    valid_until: "2026-06-08",
    start_note: "2026-06-15 以降の着手を想定",
    lines: [
      { label: "空調定期点検（48台・年4回）", unit_price_yen: 1_750_000, quantity: 1 },
      { label: "エレベータ年間保守（1台あたり）", unit_price_yen: 495_000, quantity: 4 },
      { label: "消防法令点検", unit_price_yen: 410_000, quantity: 1 },
      { label: "照明・非常灯巡回（月1）", unit_price_yen: 65_000, quantity: 12 },
    ],
  },
  {
    vendor_id: "ion-delight-style",
    display_name: "グリーンビルテック株式会社（統合FM・架空）",
    valid_until: "2026-06-20",
    start_note: "契約締結後2週間以内に初回点検",
    lines: [
      { label: "空調定期点検（48台・年4回）", unit_price_yen: 1_800_000, quantity: 1 },
      { label: "エレベータ年間保守（1台あたり）", unit_price_yen: 540_000, quantity: 4 },
      { label: "消防法令点検", unit_price_yen: 395_000, quantity: 1 },
      { label: "照明・非常灯巡回（月1）", unit_price_yen: 71_000, quantity: 12 },
    ],
  },
];

/** @param {typeof MOCK_QUOTES[number]} q */
function withTotals(q) {
  const subtotal = q.lines.reduce((s, l) => s + l.unit_price_yen * l.quantity, 0);
  const tax = Math.round(subtotal * 0.1);
  return {
    ...q,
    subtotal_yen: subtotal,
    tax_yen: tax,
    total_yen: subtotal + tax,
  };
}

const QUOTES = MOCK_QUOTES.map(withTotals).sort((a, b) => a.total_yen - b.total_yen);

/** @type {HTMLElement | null} */
const $ = (id) => document.getElementById(id);

function yen(n) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function setStep(step) {
  document.querySelectorAll(".fps-item").forEach((el) => {
    const n = Number(el.getAttribute("data-step"));
    el.classList.toggle("is-active", n === step);
    el.classList.toggle("is-done", n < step);
  });
  const fill = $("flow-progress-fill");
  if (fill) {
    const pct = Math.min(100, Math.max(0, ((step - 1) / 5) * 100));
    fill.style.width = `${pct}%`;
  }
}

function showHero() {
  $("screen-hero")?.removeAttribute("hidden");
  $("screen-flow")?.setAttribute("hidden", "");
  $("btn-replay")?.setAttribute("hidden", "");
}

function showFlow() {
  $("screen-hero")?.setAttribute("hidden", "");
  $("screen-flow")?.removeAttribute("hidden");
  $("btn-replay")?.removeAttribute("hidden");
}

function showPane(num) {
  for (let i = 1; i <= 6; i++) {
    const pane = $(`pane-${i}`);
    if (!pane) continue;
    pane.toggleAttribute("hidden", num !== i);
  }
  if (num >= 1 && num <= 6) {
    setStep(num);
  }
}

function resetAgentAndLaterPanes() {
  const log = $("agent-log");
  if (log) log.innerHTML = "";
  $("vendor-chips").innerHTML = "";
  const bar = $("progress-bar");
  if (bar) bar.style.width = "0%";
  const pl = $("progress-label");
  if (pl) pl.textContent = "準備中…";
  $("btn-to-consolidate")?.setAttribute("hidden", "");
  const cr = $("consolidate-root");
  if (cr) cr.innerHTML = "";
  const ap = $("approval-summary");
  if (ap) ap.innerHTML = "";
  const cs = $("client-sheet");
  if (cs) cs.innerHTML = "";
  const bc = $("boss-check");
  if (bc) bc.checked = false;
  const btc = $("btn-to-client");
  if (btc) btc.disabled = true;
  $("compare-root").innerHTML = "";
}

function resetPrechat() {
  prechatAnswers = [];
  prechatBusy = false;
  const thread = $("prechat-thread");
  if (thread) thread.innerHTML = "";
  clearPrechatSuggestions();
  const input = $("prechat-input");
  if (input instanceof HTMLTextAreaElement) input.value = "";
  setPrechatComposerState(false);
  $("prechat-summary")?.setAttribute("hidden", "");
  $("btn-show-rfq")?.setAttribute("hidden", "");
  $("btn-to-vendors")?.setAttribute("hidden", "");
  $("rfq-section")?.setAttribute("hidden", "");
}

/** @param {boolean} enabled */
function setPrechatComposerState(enabled) {
  const input = $("prechat-input");
  const send = $("btn-prechat-send");
  if (input instanceof HTMLTextAreaElement) {
    input.disabled = !enabled;
    if (enabled) {
      input.removeAttribute("aria-disabled");
    } else {
      input.setAttribute("aria-disabled", "true");
    }
  }
  if (send instanceof HTMLButtonElement) send.disabled = !enabled;
}

function clearPrechatSuggestions() {
  const el = $("prechat-suggestions");
  if (el) el.innerHTML = "";
}

/**
 * @param {string[] | undefined} suggestions
 */
function renderPrechatSuggestions(suggestions) {
  const root = $("prechat-suggestions");
  const input = $("prechat-input");
  if (!root || !(input instanceof HTMLTextAreaElement)) return;
  root.innerHTML = "";
  if (!suggestions?.length) return;
  for (const s of suggestions) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "prechat-suggestion";
    b.textContent = s;
    b.addEventListener("click", () => {
      input.value = s;
      input.focus();
    });
    root.appendChild(b);
  }
}

function appendAgentBubble(html) {
  const thread = $("prechat-thread");
  if (!thread) return;
  const row = document.createElement("div");
  row.className = "chat-row agent";
  row.innerHTML = `<div class="chat-bubble agent">${html}</div>`;
  thread.appendChild(row);
  thread.scrollTop = thread.scrollHeight;
}

function appendUserBubble(text) {
  const thread = $("prechat-thread");
  if (!thread) return;
  const row = document.createElement("div");
  row.className = "chat-row user";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble user";
  bubble.textContent = text;
  row.appendChild(bubble);
  thread.appendChild(row);
  thread.scrollTop = thread.scrollHeight;
}

function showPrechatSummary() {
  clearPrechatSuggestions();
  setPrechatComposerState(false);
  const ul = $("prechat-summary-list");
  ul.innerHTML = "";
  for (const a of prechatAnswers) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${a.title}</strong>：${escapeHtml(a.answer)}`;
    ul.appendChild(li);
  }
  $("prechat-summary")?.removeAttribute("hidden");
  $("btn-show-rfq")?.removeAttribute("hidden");
  $("prechat-thread")?.scrollTo?.(0, 99999);
}

/** @param {string} s */
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function submitPrechat() {
  const idx = prechatAnswers.length;
  if (idx >= PRECHAT_SCRIPT.length || prechatBusy) return;
  const input = $("prechat-input");
  if (!(input instanceof HTMLTextAreaElement)) return;
  const text = input.value.trim();
  if (!text) return;

  prechatBusy = true;
  clearPrechatSuggestions();
  setPrechatComposerState(false);
  input.value = "";
  appendUserBubble(text);
  prechatAnswers.push({
    title: PRECHAT_SCRIPT[idx].summaryTitle,
    answer: text,
  });

  try {
    await sleep(400);
    const next = prechatAnswers.length;
    if (next < PRECHAT_SCRIPT.length) {
      appendAgentBubble(PRECHAT_SCRIPT[next].agent);
      renderPrechatSuggestions(PRECHAT_SCRIPT[next].suggestions);
      setPrechatComposerState(true);
      input.focus();
    } else {
      showPrechatSummary();
    }
  } finally {
    prechatBusy = false;
  }
}

async function beginPrechat() {
  resetPrechat();
  await sleep(280);
  appendAgentBubble(PRECHAT_SCRIPT[0].agent);
  renderPrechatSuggestions(PRECHAT_SCRIPT[0].suggestions);
  setPrechatComposerState(true);
  const input = $("prechat-input");
  if (input instanceof HTMLTextAreaElement) input.focus();
}

async function skipPrechatWithSample() {
  resetPrechat();
  setPrechatComposerState(false);
  for (let i = 0; i < PRECHAT_SCRIPT.length; i++) {
    appendAgentBubble(PRECHAT_SCRIPT[i].agent);
    await sleep(160);
    const ans = PRECHAT_SAMPLE_TEXTS[i] ?? "";
    appendUserBubble(ans);
    prechatAnswers.push({
      title: PRECHAT_SCRIPT[i].summaryTitle,
      answer: ans,
    });
    await sleep(140);
  }
  showPrechatSummary();
}

function fillRfq() {
  $("rfq-id").textContent = RFQ.request_id;
  $("rfq-facility").textContent = `${RFQ.facility.name} — ${RFQ.facility.address}`;
  $("rfq-area").textContent = `${RFQ.facility.floor_area_m2.toLocaleString("ja-JP")} m²（${RFQ.facility.note}）`;
  $("rfq-category").textContent = RFQ.scope.category;
  $("rfq-buyer").textContent = `${RFQ.contact.company} · ${RFQ.contact.email}`;
  $("rfq-period").textContent = RFQ.scope.period;
  $("rfq-due").textContent = RFQ.due_date;
  $("rfq-notes").textContent = `備考: ${RFQ.scope.notes}`;

  const ul = $("rfq-items");
  ul.innerHTML = "";
  for (const it of RFQ.scope.items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${it.description}</span><span class="code">${it.quantity}${it.unit} · ${it.code}</span>`;
    ul.appendChild(li);
  }
}

function renderVendorChips(statusById) {
  const root = $("vendor-chips");
  if (!root) return;
  root.innerHTML = "";
  for (const v of VENDORS) {
    const st = statusById[v.vendor_id] ?? "queued";
    const li = document.createElement("li");
    const cls =
      st === "ok" ? "statusOk" : st === "sent" ? "statusSent" : "statusQueued";
    const label =
      st === "ok" ? "回答取得" : st === "sent" ? "依頼キュー済" : "待機";
    li.innerHTML = `<span>${v.display_name}</span><span class="status ${cls}">${label}</span>`;
    root.appendChild(li);
  }
}

/**
 * @param {string} level
 * @param {string} msg
 */
function logLine(level, msg) {
  const log = $("agent-log");
  if (!log) return;
  const p = document.createElement("p");
  p.className = "agent-log-line";
  p.innerHTML = `<strong>${level}</strong> ${msg}`;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** @param {number} pct */
function setProgress(pct, label) {
  const bar = $("progress-bar");
  if (bar) bar.style.width = `${pct}%`;
  const pl = $("progress-label");
  if (pl) pl.textContent = label;
}

/** ステップ2: 各社への見積依頼（キュー投入まで） */
async function runRequestPhase() {
  const log = $("agent-log");
  log.innerHTML = "";
  $("vendor-chips").innerHTML = "";
  $("btn-to-consolidate")?.setAttribute("hidden", "");
  renderVendorChips({});
  setProgress(5, "…");
  logLine("情報", "送信はしません（デモ）。");

  await sleep(280);
  setProgress(28, "…");
  logLine("整形", RFQ.request_id);
  await sleep(280);
  setProgress(40, "…");

  const status = Object.fromEntries(VENDORS.map((v) => [v.vendor_id, "queued"]));
  renderVendorChips(status);
  await sleep(400);

  for (let i = 0; i < VENDORS.length; i++) {
    const v = VENDORS[i];
    logLine("依頼", `${v.display_name} 宛のキューを作成（${v.channel_label}）。`);
    status[v.vendor_id] = "sent";
    renderVendorChips(status);
    const pct = 52 + Math.round(((i + 1) / VENDORS.length) * 40);
    setProgress(pct, "…");
    await sleep(380);
  }

  setProgress(100, "完了");
  logLine("完了", `${VENDORS.length}社キュー`);
  await sleep(350);
  $("btn-to-consolidate")?.removeAttribute("hidden");
}

const CONSOLIDATE_RAW = [
  {
    vendor: "中央設備メンテナンス（架空）",
    format: "PDF 3枚",
    body: "Re: 見積依頼 — 空調は「パッケージ48台」と本文で表記ゆれ。EL列は別シート参照の旨（架空）。",
  },
  {
    vendor: "ベイエリアFM（架空）",
    format: "Excel .xlsx",
    body: "シート1に総額のみ・明細はシート2。項目名が社内略語（架空）。",
  },
  {
    vendor: "グリーンビルテック（架空）",
    format: "ポータルCSV",
    body: "ダウンロードしたCSVの列順が他社と異なるが、見積番号は付与済み（架空）。",
  },
];

function renderConsolidate() {
  const root = $("consolidate-root");
  if (!root) return;
  root.innerHTML = "";

  const rawWrap = document.createElement("div");
  rawWrap.className = "raw-inbound-grid";
  for (const r of CONSOLIDATE_RAW) {
    const card = document.createElement("div");
    card.className = "raw-inbound-card";
    card.innerHTML = `<div class="raw-inbound-head"><strong>${escapeHtml(r.vendor)}</strong><span class="raw-tag">${escapeHtml(r.format)}</span></div><p class="raw-inbound-body">${escapeHtml(r.body)}</p>`;
    rawWrap.appendChild(card);
  }
  root.appendChild(rawWrap);

  const arrow = document.createElement("div");
  arrow.className = "consolidate-arrow";
  arrow.textContent = "↓";
  root.appendChild(arrow);

  const tableWrap = document.createElement("div");
  tableWrap.className = "consolidate-table-wrap";
  const table = document.createElement("table");
  table.className = "line-table consolidate-master";
  const head = document.createElement("thead");
  head.innerHTML =
    "<tr><th>項目コード</th><th>統一名称</th><th>中央設備</th><th>ベイFM</th><th>GBテック</th></tr>";
  table.appendChild(head);
  const tb = document.createElement("tbody");
  const rows = [
    ["PAC-INS-26", "空調定期点検（48台・年4回）", "◎", "◎", "◎"],
    ["ELV-FM-26", "エレベータ年間保守（4台）", "◎", "◎", "◎"],
    ["FIRE-INS", "消防法令点検", "◎", "◎", "◎"],
    ["LED-PAT", "照明・非常灯巡回（月1）", "◎", "◎", "◎"],
  ];
  for (const row of rows) {
    const tr = document.createElement("tr");
    row.forEach((c, i) => {
      const td = document.createElement("td");
      td.textContent = c;
      if (i >= 2) td.className = "num";
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  tableWrap.appendChild(table);
  root.appendChild(tableWrap);
}

function renderApprovalSummary() {
  const el = $("approval-summary");
  if (!el) return;
  const best = QUOTES[0];

  el.innerHTML = `
    <ul class="approval-list approval-list--compact">
      <li>${escapeHtml(RFQ.facility.name)} · ${escapeHtml(RFQ.request_id)}</li>
      <li>最安 ${escapeHtml(best.display_name)} · ${yen(best.total_yen)}</li>
      <li>有効 ${escapeHtml(best.valid_until)}</li>
    </ul>
  `;
}

function renderClientSheet() {
  const el = $("client-sheet");
  if (!el) return;
  const best = QUOTES[0];
  const second = QUOTES[1];
  const third = QUOTES[2];

  el.innerHTML = `
    <div class="client-sheet-inner">
      <h3 class="client-title">${escapeHtml(RFQ.facility.name)}</h3>
      <ol class="client-ranking">
        <li>${escapeHtml(best.display_name)} · ${yen(best.total_yen)}</li>
        <li>${escapeHtml(second.display_name)} · ${yen(second.total_yen)}</li>
        <li>${escapeHtml(third.display_name)} · ${yen(third.total_yen)}</li>
      </ol>
      <p class="client-note">デモ · 架空</p>
    </div>
  `;
}

function renderCompare() {
  const root = $("compare-root");
  root.innerHTML = "";

  QUOTES.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "quote-card" + (idx === 0 ? " best" : "");
    const top = document.createElement("div");
    top.className = "quote-top";
    top.innerHTML = `
      <div>
        <div class="quote-name">${q.display_name}</div>
        <div class="quote-meta">見積有効期限（架空）: ${q.valid_until} · ${q.start_note}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
        ${idx === 0 ? `<span class="tag">最安</span>` : ""}
        <div class="total">${yen(q.total_yen)}</div>
      </div>
    `;
    const table = document.createElement("table");
    table.className = "line-table";
    table.innerHTML =
      "<thead><tr><th>明細</th><th class='num'>単価</th><th class='num'>数量</th><th class='num'>小計</th></tr></thead>";
    const tb = document.createElement("tbody");
    for (const line of q.lines) {
      const sub = line.unit_price_yen * line.quantity;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${line.label}</td>
        <td class="num">${yen(line.unit_price_yen)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">${yen(sub)}</td>`;
      tb.appendChild(tr);
    }
    const tf = document.createElement("tr");
    tf.innerHTML = `<td colspan="3">小計（税抜）</td><td class="num">${yen(q.subtotal_yen)}</td>`;
    tb.appendChild(tf);
    const tr2 = document.createElement("tr");
    tr2.innerHTML = `<td colspan="3">消費税（10%）</td><td class="num">${yen(q.tax_yen)}</td>`;
    tb.appendChild(tr2);
    table.appendChild(tb);

    card.appendChild(top);
    card.appendChild(table);
    root.appendChild(card);
  });
}

function startDemo() {
  showFlow();
  resetAgentAndLaterPanes();
  fillRfq();
  showPane(1);
  void beginPrechat();
}

async function replay() {
  showFlow();
  resetAgentAndLaterPanes();
  fillRfq();
  showPane(1);
  await beginPrechat();
}

function wire() {
  $("btn-start").addEventListener("click", startDemo);

  $("btn-prechat-sample").addEventListener("click", () => {
    void skipPrechatWithSample();
  });

  const preInput = $("prechat-input");
  if (preInput instanceof HTMLTextAreaElement) {
    preInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      e.preventDefault();
      void submitPrechat();
    });
  }
  $("btn-prechat-send")?.addEventListener("click", () => {
    void submitPrechat();
  });

  $("btn-show-rfq").addEventListener("click", () => {
    $("rfq-section")?.removeAttribute("hidden");
    $("btn-show-rfq")?.setAttribute("hidden", "");
    $("btn-to-vendors")?.removeAttribute("hidden");
  });

  $("btn-to-vendors").addEventListener("click", async () => {
    showPane(2);
    await runRequestPhase();
  });

  $("btn-to-consolidate").addEventListener("click", () => {
    showPane(3);
    renderConsolidate();
  });

  $("btn-to-amounts").addEventListener("click", () => {
    showPane(4);
    renderCompare();
  });

  $("btn-to-approval").addEventListener("click", () => {
    showPane(5);
    renderApprovalSummary();
  });

  $("boss-check")?.addEventListener("change", (e) => {
    const t = e.target;
    const btn = $("btn-to-client");
    if (btn && t instanceof HTMLInputElement) {
      btn.disabled = !t.checked;
    }
  });

  $("btn-to-client").addEventListener("click", () => {
    showPane(6);
    renderClientSheet();
  });

  $("btn-replay").addEventListener("click", () => {
    showHero();
  });

  $("btn-replay-bottom").addEventListener("click", () => {
    void replay();
  });
}

wire();
