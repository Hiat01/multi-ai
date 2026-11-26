// Multi-AI — ask several AI providers at once, keep the best answer.
// All keys live only in this browser's localStorage. Nothing is sent
// anywhere except to the provider endpoints the user added.

const STORE_PROVIDERS = "multi-ai-providers";
const STORE_HISTORY = "multi-ai-history";

const PRESETS = {
  openrouter: { name: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free" },
  freemodel: { name: "FreeModel", endpoint: "https://freemodel.in/v1/chat/completions", model: "glm-5.3-flash" }
};

let providers = loadJSON(STORE_PROVIDERS, []);
let history = loadJSON(STORE_HISTORY, []);
let lastRound = null; // { prompt, answers: [{providerId, name, model, status, text, error, ms}] }

function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; }
}
function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
function uid() { return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function wordCount(t) { return (String(t).trim().match(/\S+/g) || []).length; }

async function callAI(provider, messages) {
  const res = await fetch(provider.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + provider.key },
    body: JSON.stringify({ model: provider.model, messages: messages })
  });
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = (j.error && (j.error.message || j.error)) || ""; } catch (e) {}
    throw new Error("HTTP " + res.status + (detail ? " — " + detail : ""));
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error("Empty response from provider.");
  return text;
}

// ---------- Providers ----------
function renderProviders() {
  const list = document.getElementById("providerList");
  document.getElementById("noProviderMsg").style.display = providers.length ? "none" : "";
  list.innerHTML = providers.map(function (p) {
    const status = p.lastTest ? ("<span class='pstatus " + (p.lastTest.ok ? "ok" : "bad") + "'>" + esc(p.lastTest.ok ? "✓ Key works" : "✗ " + p.lastTest.msg) + "</span>") : "";
    return "<div class='provider' data-id='" + p.id + "'>" +
      "<label class='toggle'><input type='checkbox' class='enable' " + (p.enabled ? "checked" : "") + "> Enabled</label>" +
      "<span class='pname'>" + esc(p.name) + "</span>" +
      "<span class='pmeta'>" + esc(p.model) + " · " + esc(p.endpoint) + "</span>" +
      status +
      "<span class='spacer'></span>" +
      "<button class='btn small test-btn'>Test</button>" +
      "<button class='btn small del-btn'>Delete</button>" +
      "</div>";
  }).join("");
  list.querySelectorAll(".provider").forEach(function (el) {
    const p = providers.find(function (x) { return x.id === el.dataset.id; });
    if (!p) return;
    el.querySelector(".enable").addEventListener("change", function (e) { p.enabled = e.target.checked; saveJSON(STORE_PROVIDERS, providers); });
    el.querySelector(".del-btn").addEventListener("click", function () {
      providers = providers.filter(function (x) { return x.id !== p.id; });
      saveJSON(STORE_PROVIDERS, providers); renderProviders();
    });
    el.querySelector(".test-btn").addEventListener("click", async function (btn) {
      btn = btn.target; btn.disabled = true; btn.textContent = "Testing…";
      try {
        await callAI(p, [{ role: "user", content: "Reply with exactly: OK" }]);
        p.lastTest = { ok: true, msg: "" };
      } catch (e) { p.lastTest = { ok: false, msg: e.message }; }
      saveJSON(STORE_PROVIDERS, providers); renderProviders();
    });
  });
}

function addProvider(name, endpoint, model, key) {
  providers.push({ id: uid(), name: name, endpoint: endpoint, model: model, key: key, enabled: true, lastTest: null });
  saveJSON(STORE_PROVIDERS, providers); renderProviders();
}

document.querySelectorAll("[data-preset]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const preset = PRESETS[btn.dataset.preset];
    const key = prompt("Enter your API key for " + preset.name + " (stored only in this browser):");
    if (key === null) return;
    if (!key.trim()) { alert("No key entered — provider not added."); return; }
    addProvider(preset.name, preset.endpoint, preset.model, key.trim());
  });
});
document.getElementById("showCustomBtn").addEventListener("click", function () {
  document.getElementById("customForm").classList.toggle("hidden");
});
document.getElementById("customForm").addEventListener("submit", function (e) {
  e.preventDefault();
  addProvider(
    document.getElementById("cfName").value.trim(),
    document.getElementById("cfEndpoint").value.trim(),
    document.getElementById("cfModel").value.trim(),
    document.getElementById("cfKey").value.trim()
  );
  e.target.reset(); e.target.classList.add("hidden");
});

// ---------- Ask ----------
document.querySelectorAll("#promptPresets [data-prompt]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const input = document.getElementById("promptInput");
    if (!input.value.startsWith(btn.dataset.prompt)) input.value = btn.dataset.prompt + input.value;
    input.focus();
  });
});

function renderAnswers() {
  const section = document.getElementById("answersSection");
  const grid = document.getElementById("answersGrid");
  if (!lastRound) { section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  grid.innerHTML = lastRound.answers.map(function (a, i) {
    const cls = a.status === "failed" ? " failed" : (a.status === "thinking" ? " thinking" : "");
    const body = a.status === "done" ? esc(a.text) :
      a.status === "failed" ? "Failed: " + esc(a.error || "Unknown error") : "Thinking…";
    const meta = a.status === "done"
      ? wordCount(a.text) + " words · " + (a.ms / 1000).toFixed(1) + "s"
      : (a.status === "failed" ? a.model : a.model + " · waiting…");
    return "<div class='answer-card" + cls + "' data-i='" + i + "'>" +
      "<h3>" + esc(a.name) + "</h3><div class='meta'>" + esc(meta) + "</div>" +
      "<div class='body'>" + body + "</div>" +
      "<div class='actions'>" +
      (a.status === "done" ? "<button class='btn small copy-btn'>Copy</button><button class='btn small use-btn'>Use this as best</button>" : "") +
      "</div></div>";
  }).join("");
  grid.querySelectorAll(".answer-card").forEach(function (el) {
    const a = lastRound.answers[+el.dataset.i];
    const copyBtn = el.querySelector(".copy-btn");
    if (copyBtn) copyBtn.addEventListener("click", function () { copyText(a.text, copyBtn); });
    const useBtn = el.querySelector(".use-btn");
    if (useBtn) useBtn.addEventListener("click", function () { setBest(a.text, "Picked from " + a.name); });
  });
  updateBestSection();
}

function updateBestSection() {
  const ok = lastRound && lastRound.answers.some(function (a) { return a.status === "done"; });
  document.getElementById("bestSection").classList.toggle("hidden", !ok);
  const sel = document.getElementById("judgeSelect");
  const done = (lastRound ? lastRound.answers : []).filter(function (a) { return a.status === "done"; });
  sel.innerHTML = done.map(function (a) { return "<option value='" + a.providerId + "'>" + esc(a.name) + " (judge)</option>"; }).join("");
}

function setBest(text, note) {
  document.getElementById("bestAnswer").textContent = (note ? note + "\n\n" : "") + text;
  document.getElementById("bestSection").scrollIntoView({ behavior: "smooth" });
}

async function askProviders(list) {
  const prompt = document.getElementById("promptInput").value.trim();
  if (!prompt) { alert("Type a question first."); return; }
  if (!list.length) { alert("Enable at least one provider first."); return; }
  document.getElementById("askStatus").textContent = "Asking " + list.length + " AI(s)…";
  document.getElementById("askBtn").disabled = true;
  document.getElementById("retryBtn").classList.add("hidden");
  document.getElementById("bestAnswer").textContent = "";
  lastRound = { prompt: prompt, answers: list.map(function (p) {
    return { providerId: p.id, name: p.name, model: p.model, status: "thinking", text: "", error: "", ms: 0 };
  }) };
  renderAnswers();
  const results = await Promise.allSettled(list.map(async function (p, i) {
    const t0 = Date.now();
    const text = await callAI(p, [{ role: "user", content: prompt }]);
    return { i: i, text: text, ms: Date.now() - t0 };
  }));
  results.forEach(function (r, i) {
    const a = lastRound.answers[i];
    if (r.status === "fulfilled") { a.status = "done"; a.text = r.value.text; a.ms = r.value.ms; }
    else { a.status = "failed"; a.error = (r.reason && r.reason.message) || "Request failed"; }
  });
  document.getElementById("askStatus").textContent = "";
  document.getElementById("askBtn").disabled = false;
  renderAnswers();
  if (lastRound.answers.some(function (a) { return a.status === "failed"; })) {
    document.getElementById("retryBtn").classList.remove("hidden");
  }
  history.unshift({ prompt: prompt, time: new Date().toISOString(), answers: lastRound.answers.map(function (a) { return { providerId: a.providerId, name: a.name, model: a.model, status: a.status, text: a.text }; }) });
  history = history.slice(0, 10);
  saveJSON(STORE_HISTORY, history); renderHistory();
}

document.getElementById("askBtn").addEventListener("click", function () {
  askProviders(providers.filter(function (p) { return p.enabled; }));
});
document.getElementById("retryBtn").addEventListener("click", function () {
  const failed = lastRound.answers.filter(function (a) { return a.status === "failed"; })
    .map(function (a) { return providers.find(function (p) { return p.id === a.providerId; }); })
    .filter(Boolean);
  failed.forEach(function (p) {
    const a = lastRound.answers.find(function (x) { return x.providerId === p.id; });
    a.status = "thinking"; a.error = ""; a.text = "";
  });
  renderAnswers();
  (async function () {
    const results = await Promise.allSettled(failed.map(async function (p) {
      const t0 = Date.now();
      const text = await callAI(p, [{ role: "user", content: lastRound.prompt }]);
      return { id: p.id, text: text, ms: Date.now() - t0 };
    }));
    results.forEach(function (r) {
      const a = lastRound.answers.find(function (x) { return x.providerId === (r.status === "fulfilled" ? r.value.id : null); });
      if (r.status === "fulfilled" && a) { a.status = "done"; a.text = r.value.text; a.ms = r.value.ms; }
      else if (a) { a.status = "failed"; a.error = (r.reason && r.reason.message) || "Request failed"; }
    });
    renderAnswers();
  })();
});

// ---------- Best Answer (AI judge) ----------
document.getElementById("judgeBtn").addEventListener("click", async function () {
  const done = lastRound.answers.filter(function (a) { return a.status === "done"; });
  if (done.length < 1) { alert("No successful answers yet."); return; }
  const judgeId = document.getElementById("judgeSelect").value;
  const judge = providers.find(function (p) { return p.id === judgeId; }) || providers.find(function (p) { return p.id === done[0].providerId; });
  if (!judge) { alert("Judge provider not found."); return; }
  const btn = document.getElementById("judgeBtn");
  btn.disabled = true; btn.textContent = "Judge is merging…";
  const combined = done.map(function (a, i) { return "--- Answer " + (i + 1) + " (" + a.name + ") ---\n" + a.text; }).join("\n\n");
  const judgePrompt = "You are a strict editor. Below are several AI answers to the same user question.\n\nUSER QUESTION:\n" + lastRound.prompt +
    "\n\n" + combined +
    "\n\nRank the answers, then write ONE improved final answer that keeps the strongest, most accurate parts of all of them, fixes errors, and removes repetition. Output ONLY the final improved answer, nothing else.";
  try {
    const merged = await callAI(judge, [{ role: "user", content: judgePrompt }]);
    setBest(merged, "Judge-merged best answer (judge: " + judge.name + ")");
  } catch (e) {
    alert("Judge failed: " + e.message + " — pick an answer manually instead.");
  }
  btn.disabled = false; btn.textContent = "Make Best Answer (AI judge)";
});

function copyText(text, btn) {
  function done() { if (btn) { btn.textContent = "Copied!"; setTimeout(function () { btn.textContent = "Copy"; }, 1500); } }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  else { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} document.body.removeChild(ta); }
}
document.getElementById("copyBestBtn").addEventListener("click", function (e) {
  copyText(document.getElementById("bestAnswer").textContent, e.target);
});
document.getElementById("downloadBestBtn").addEventListener("click", function () {
  const text = document.getElementById("bestAnswer").textContent;
  if (!text.trim()) { alert("No Best Answer yet."); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = "best-answer.txt"; a.click(); URL.revokeObjectURL(a.href);
});

// ---------- History ----------
function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = history.length ? history.map(function (h, i) {
    return "<div class='history-item' data-i='" + i + "'><div class='q'>" + esc(h.prompt.slice(0, 120)) + "</div><div class='t'>" + esc(new Date(h.time).toLocaleString()) + " · " + h.answers.length + " answer(s)</div></div>";
  }).join("") : "<p class='hint'>No history yet.</p>";
  list.querySelectorAll(".history-item").forEach(function (el) {
    el.addEventListener("click", function () {
      const h = history[+el.dataset.i];
      document.getElementById("promptInput").value = h.prompt;
      lastRound = { prompt: h.prompt, answers: h.answers.map(function (a) { return { providerId: a.providerId || "", name: a.name, model: a.model || "", status: a.status, text: a.text, error: "", ms: 0 }; }) };
      renderAnswers();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}
document.getElementById("clearHistoryBtn").addEventListener("click", function () {
  history = []; saveJSON(STORE_HISTORY, history); renderHistory();
});

// ---------- Share ----------
document.getElementById("shareBtn").addEventListener("click", function (e) {
  copyText(window.location.href, e.target);
  e.target.textContent = "Link copied!";
  setTimeout(function () { e.target.textContent = "Share"; }, 1500);
});

renderProviders();
renderHistory();
