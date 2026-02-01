let settings = {};
let linkAuraMap = new Map();

let pollingInterval = null;
let pollingAttempts = 0;

let lastMousePosition = { x: 0, y: 0 };
let tooltipEl = null;
let tooltipPinned = false;

let hasInitiatedOnce = false;
let mutationObserver = null;
let styleInjected = false;

const API_URL = "https://api.wai.ventureout.cz/analyze";

// ---------- INIT ----------
async function initialize() {
  const data = await chrome.storage.sync.get("waiSettings");
  settings = {
    previewMethod: "hover",          // 'hover' | 'context' | 'never'
    auraIntensity: 60,               // 0..100
    highlightStyle: "underline",     // 'underline' | 'background' (zatím)
    interests: "",
    exclusions: "",
    enableDebug: false,
    ...data.waiSettings,
  };

  injectStylesOnce();
  ensureTooltip();
  updateEventListeners();
  ensureObserver();

  // Auto-run 1× po loadu stránky (aby to “žilo” i bez kliku v popup)
  if (!hasInitiatedOnce) {
    hasInitiatedOnce = true;
    setTimeout(() => initiateAnalysis(false), 250);
  }
}

function debugLog(...args) {
  if (settings.enableDebug) console.log("[WAI]", ...args);
}

// ---------- MESSAGES ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.type === "REQUEST_AURA_ANALYSIS") {
      initiateAnalysis(!!request.force);
      sendResponse?.({ ok: true });
    } else if (request.type === "AURA_DATA_UPDATE") {
      buildAuraMapFromApiLinks(request.links || []);
      applyAuraStylesToPage(false);
      sendResponse?.({ ok: true });
    } else if (request.type === "SHOW_AURA_PREVIEW") {
      // Toto je určeno pro klik v context menu položce (z background.js).
      const aura = linkAuraMap.get(normalizeUrl(request.url));
      if (aura) {
        tooltipPinned = true;
        showAuraPreview(aura, lastMousePosition.x, lastMousePosition.y, true);
      }
      sendResponse?.({ ok: true });
    } else if (request.type === "SETTINGS_UPDATED") {
      settings = { ...settings, ...(request.settings || {}) };
      injectStylesOnce();
      updateEventListeners();
      applyAuraStylesToPage(!!pollingInterval);
      sendResponse?.({ ok: true });
    }
  } catch (e) {
    console.error("[WAI] onMessage error:", e);
    sendResponse?.({ ok: false, error: String(e?.message || e) });
  }
  return true;
});

// ---------- ANALYSIS ----------
function collectInitialData() {
  return {
    url: window.location.href,
    title: document.title,
    h1Count: document.getElementsByTagName("h1").length,
    text: (document.body?.innerText || "").substring(0, 2000),
  };
}

async function initiateAnalysis(force = false) {
  stopPolling();
  pollingAttempts = 0;

  // Okamžitá jemná “předběžná” vizuální odezva (lokální heuristika)
  buildAuraMapFromLocalHeuristics();
  applyAuraStylesToPage(true);
  chrome.runtime.sendMessage({ type: "SET_BADGE", color: "#808080", text: "..." });

  const localData = collectInitialData();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: window.location.href,
        interests: settings.interests,
        exclusions: settings.exclusions,
        localData,
        force_recrawl: force,
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    debugLog("initiateAnalysis response", data);

    if (data.status === "completed" && data.pageAura) {
      buildAuraMapFromApiLinks(data.pageAura.links || []);
      applyAuraStylesToPage(false);
      if (data.domainAura) chrome.runtime.sendMessage({ type: "SET_BADGE", color: data.domainAura.color, text: "✓" });
      return;
    }

    // preliminary / analyzing_* → polling
    startPolling();
  } catch (error) {
    console.error("[WAI] Initial analysis request failed:", error);
    chrome.runtime.sendMessage({ type: "SET_BADGE", color: "#808080", text: "!" });
  }
}

function startPolling() {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    pollingAttempts += 1;
    if (pollingAttempts > 24) { // ~2 min při 5s
      stopPolling();
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: window.location.href }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      debugLog("poll response", data);

      if (data.status === "completed" && data.pageAura) {
        stopPolling();
        buildAuraMapFromApiLinks(data.pageAura.links || []);
        applyAuraStylesToPage(false);
        if (data.domainAura) chrome.runtime.sendMessage({ type: "SET_BADGE", color: data.domainAura.color, text: "✓" });
      }
    } catch (e) {
      console.error("[WAI] Polling failed:", e);
      stopPolling();
    }
  }, 5000);
}

function stopPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = null;
}

// ---------- URL HELPERS ----------
function normalizeUrl(u) {
  try {
    return new URL(u).href.split("#")[0];
  } catch (e) {
    return (u || "").split("#")[0];
  }
}

// ---------- AURA MAP BUILD ----------
function buildAuraMapFromApiLinks(linksData) {
  if (!Array.isArray(linksData) || linksData.length === 0) return;

  linksData.forEach((row) => {
    try {
      // DB řádek: target_url + link_aura_circle
      const url = normalizeUrl(row.target_url || row.url);
      const aura = row.link_aura_circle || row.aura || null;
      if (url && aura) linkAuraMap.set(url, aura);
    } catch (_) {}
  });
}

function buildAuraMapFromLocalHeuristics() {
  document.querySelectorAll("a[href]").forEach((a) => {
    try {
      const url = normalizeUrl(a.href);
      if (!url) return;
      if (!linkAuraMap.has(url)) linkAuraMap.set(url, generateLocalLinkAura(url));
    } catch (_) {}
  });
}

function generateLocalLinkAura(url) {
  const u = new URL(url);
  const currentHost = window.location.hostname;
  const host = u.hostname.toLowerCase();

  let color = "blue";
  let intent = u.hostname !== currentHost ? "Odkaz na externí doménu." : "Interní odkaz.";

  if (host.includes("facebook.") || host.includes("twitter.") || host.includes("linkedin.") || host.includes("instagram.")) {
    color = "indigo"; intent = "Odkaz na sociální síť.";
  } else if (u.pathname.match(/\.(zip|pdf|exe|dmg|rar|7z|tar\.gz)$/i)) {
    color = "orange"; intent = "Odkaz ke stažení souboru.";
  } else if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("vimeo.com")) {
    color = "red"; intent = "Odkaz na video platformu.";
  } else if (u.hostname !== currentHost) {
    color = "indigo";
  }

  return {
    circle: { color, intent },
    star: {
      stability: { value: 50, saturation: 25 },
      flow: { value: 50, saturation: 25 },
      will: { value: 50, saturation: 25 },
      relation: { value: 50, saturation: 25 },
      voice: { value: 50, saturation: 25 },
      meaning: { value: 50, saturation: 25 },
      integrity: { value: 50, saturation: 25 },
    },
  };
}

// ---------- STYLES (READABLE HIGHLIGHT) ----------
function injectStylesOnce() {
  if (styleInjected) {
    // update CSS variables based on settings
    document.documentElement.style.setProperty("--wai-intensity", String(settings.auraIntensity ?? 60));
    return;
  }

  const style = document.createElement("style");
  style.id = "wai-aura-style";

  // Čitelný styl:
  // - žádný text-shadow (rozmazává)
  // - underline + jemný “inset” podklad
  // - preliminary: nižší alfa a dashed underline
  style.textContent = `
    :root {
      --wai-intensity: ${String(settings.auraIntensity ?? 60)};
      --wai-underline-thickness: calc(1px + (var(--wai-intensity) / 100) * 3px);
      --wai-bg-alpha-pre: 0.10;
      --wai-bg-alpha-final: 0.18;
    }

    a[data-wai-aura="1"]{
      text-decoration-line: underline !important;
      text-decoration-thickness: var(--wai-underline-thickness) !important;
      text-underline-offset: 2px !important;
      border-radius: 3px !important;
      padding: 0 2px !important;
      transition: background-color .15s ease, text-decoration-color .15s ease, filter .15s ease !important;
    }

    a[data-wai-stage="pre"]{
      text-decoration-style: dashed !important;
      background-color: color-mix(in srgb, var(--wai-color) calc(var(--wai-bg-alpha-pre) * 100%), transparent) !important;
      text-decoration-color: var(--wai-color) !important;
      filter: saturate(0.9);
    }

    a[data-wai-stage="final"]{
      text-decoration-style: solid !important;
      background-color: color-mix(in srgb, var(--wai-color) calc(var(--wai-bg-alpha-final) * 100%), transparent) !important;
      text-decoration-color: var(--wai-color) !important;
      filter: saturate(1.0);
    }

    /* Tooltip */
    #wai-aura-tooltip {
      position: fixed;
      z-index: 2147483647;
      max-width: 360px;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: rgba(20,20,23,0.92);
      color: #fff;
      padding: 10px 12px;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.35);
      display: none;
      pointer-events: none;
      white-space: normal;
    }

    #wai-aura-tooltip .wai-title {
      font-weight: 700;
      margin-bottom: 6px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    #wai-aura-tooltip .wai-dot {
      width: 10px; height: 10px; border-radius: 999px;
      background: var(--wai-color, #999);
      flex: 0 0 auto;
    }
    #wai-aura-tooltip .wai-body {
      opacity: 0.95;
    }
    #wai-aura-tooltip .wai-hint {
      margin-top: 6px;
      opacity: 0.7;
      font-size: 11px;
    }
  `;

  document.documentElement.appendChild(style);
  styleInjected = true;

  document.documentElement.style.setProperty("--wai-intensity", String(settings.auraIntensity ?? 60));
}

function mapAuraColorToCss(colorName) {
  // Podpora pro jednoduché názvy, které používáš.
  // Pokud API vrátí něco jako 'yellow', CSS to zvládne rovnou,
  // ale u "white" dáme světle šedou.
  if (!colorName) return "#999";
  if (colorName === "white") return "#ccc";
  return colorName;
}

function applyAuraStylesToPage(isPreliminary) {
  injectStylesOnce();

  const stage = isPreliminary ? "pre" : "final";

  document.querySelectorAll("a[href]").forEach((a) => {
    try {
      const url = normalizeUrl(a.href);
      const aura = linkAuraMap.get(url);

      if (!aura || !aura.circle) {
        // vyčisti staré
        if (a.dataset.waiAura === "1") {
          delete a.dataset.waiAura;
          delete a.dataset.waiStage;
          a.style.removeProperty("--wai-color");
          delete a.dataset.waiIntent;
        }
        return;
      }

      const cssColor = mapAuraColorToCss(aura.circle.color);
      a.dataset.waiAura = "1";
      a.dataset.waiStage = stage;
      a.style.setProperty("--wai-color", cssColor);

      // Tooltip text: uložíme intent (ať je dostupné na hover/context)
      const intent = aura.circle.intent || "";
      a.dataset.waiIntent = intent;

    } catch (_) {}
  });
}

// ---------- TOOLTIP / PREVIEW ----------
function ensureTooltip() {
  if (tooltipEl) return;
  tooltipEl = document.createElement("div");
  tooltipEl.id = "wai-aura-tooltip";
  tooltipEl.innerHTML = `
    <div class="wai-title"><span class="wai-dot"></span><span class="wai-head"></span></div>
    <div class="wai-body"></div>
    <div class="wai-hint"></div>
  `;
  document.documentElement.appendChild(tooltipEl);
}

function showAuraPreview(aura, x, y, pinned) {
  if (!tooltipEl) ensureTooltip();
  if (settings.previewMethod === "never") return;

  const cssColor = mapAuraColorToCss(aura?.circle?.color);
  tooltipEl.style.setProperty("--wai-color", cssColor);

  const head = tooltipEl.querySelector(".wai-head");
  const body = tooltipEl.querySelector(".wai-body");
  const hint = tooltipEl.querySelector(".wai-hint");

  const title = aura?.circle?.color ? `Aura: ${aura.circle.color}` : "Aura";
  const intent = aura?.circle?.intent || "Bez popisu.";
  head.textContent = title;
  body.textContent = intent;

  if (pinned) {
    hint.textContent = "Připnuto (Esc zavře).";
  } else if (settings.previewMethod === "hover") {
    hint.textContent = "Hover náhled.";
  } else if (settings.previewMethod === "context") {
    hint.textContent = "Pravé tlačítko / kontext.";
  } else {
    hint.textContent = "";
  }

  // umístění s ochranou okrajů
  const pad = 12;
  const rect = { w: 360, h: 120 };
  const vx = Math.max(pad, Math.min(window.innerWidth - rect.w - pad, x + 14));
  const vy = Math.max(pad, Math.min(window.innerHeight - rect.h - pad, y + 14));

  tooltipEl.style.left = `${vx}px`;
  tooltipEl.style.top = `${vy}px`;
  tooltipEl.style.display = "block";
}

function hideAuraPreview() {
  if (!tooltipEl) return;
  tooltipEl.style.display = "none";
}

function getAuraForElement(el) {
  if (!el) return null;
  if (el.tagName && el.tagName.toLowerCase() === "a" && el.href) {
    return linkAuraMap.get(normalizeUrl(el.href)) || null;
  }
  // pokud je hover nad child elementem uvnitř <a>
  const a = el.closest?.("a[href]");
  if (a && a.href) return linkAuraMap.get(normalizeUrl(a.href)) || null;
  return null;
}

// ---------- EVENTS ----------
function updateEventListeners() {
  // Mouse position
  document.addEventListener(
    "mousemove",
    (e) => {
      lastMousePosition = { x: e.clientX, y: e.clientY };
    },
    { passive: true }
  );

  // Hover preview (čitelné, rychlé)
  document.addEventListener(
    "mouseover",
    (e) => {
      if (settings.previewMethod !== "hover") return;
      if (tooltipPinned) return;
      const aura = getAuraForElement(e.target);
      if (aura) showAuraPreview(aura, lastMousePosition.x, lastMousePosition.y, false);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      if (settings.previewMethod !== "hover") return;
      if (tooltipPinned) return;
      // když odjíždíš mimo link (nebo mimo jeho children), schovej
      const related = e.relatedTarget;
      if (related && (related.closest?.("a[href]") === e.target.closest?.("a[href]"))) return;
      hideAuraPreview();
    },
    true
  );

  // Pravé tlačítko – i bez systémové položky kontext menu
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (settings.previewMethod !== "context") return;
      const aura = getAuraForElement(e.target);
      if (aura) {
        tooltipPinned = true;
        showAuraPreview(aura, e.clientX, e.clientY, true);
      }
    },
    true
  );

  // Esc zavře připnutý tooltip
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && tooltipPinned) {
      tooltipPinned = false;
      hideAuraPreview();
    }
  });
}

// ---------- MUTATION OBSERVER ----------
function ensureObserver() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    let added = false;
    for (const m of mutations) {
      if (!m.addedNodes?.length) continue;
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        const anchors = [];
        if (node.tagName?.toLowerCase() === "a" && node.getAttribute("href")) anchors.push(node);
        node.querySelectorAll?.("a[href]")?.forEach((a) => anchors.push(a));

        anchors.forEach((a) => {
          try {
            const url = normalizeUrl(a.href);
            if (url && !linkAuraMap.has(url)) {
              linkAuraMap.set(url, generateLocalLinkAura(url));
              added = true;
            }
          } catch (_) {}
        });
      }
    }
    if (added) applyAuraStylesToPage(!!pollingInterval);
  });

  mutationObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
}

initialize();
