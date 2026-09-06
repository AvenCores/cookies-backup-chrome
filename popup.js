// works on both Chrome and Firefox.
// NOTE: `browser` exists in Firefox and (since ~2026) in Chrome too,
// so it can't be used for Firefox detection. getBrowserInfo exists only in Firefox.
const api = typeof browser !== "undefined" ? browser : chrome;
const isFirefox =
  (typeof navigator !== "undefined" && /Firefox|FxiOS/i.test(navigator.userAgent || "")) ||
  (typeof browser !== "undefined" &&
    browser.runtime &&
    typeof browser.runtime.getBrowserInfo === "function");

// ---- i18n (25 languages, see locales.js) ----
// locales.js may fail to load (e.g. outdated package without the file),
// so never crash: fall back to English-only.
const LOCALES_LIST =
  typeof AVAILABLE_LOCALES !== "undefined" &&
  Array.isArray(AVAILABLE_LOCALES) &&
  AVAILABLE_LOCALES.length
    ? AVAILABLE_LOCALES
    : [{ code: "en", name: "English" }];
let currentLocale = "en";
// "auto" = follow the browser UI language (default), otherwise an explicit locale code
const AUTO_LOCALE = "auto";
let localeMode = AUTO_LOCALE;
const RTL_LOCALES = ["ar"];
// Inline SVG flags for the custom language menu. Regional-indicator emoji
// flags render as plain letter pairs ("GB", "RU") on Windows, which has no
// flag-emoji glyphs — so every locale gets a tiny hand-drawn SVG instead.
// Values hold the inner content of an 18x12 viewBox; our own static strings
// only, rendered via innerHTML (no CSP issue, no user data inside).
const FLAG_SVGS = {
  en: '<rect width="18" height="12" fill="#012169"/><path d="M0 0l18 12M18 0L0 12" stroke="#fff" stroke-width="2.4"/><path d="M0 0l18 12M18 0L0 12" stroke="#C8102E" stroke-width=".9"/><path d="M9 0v12M0 6h18" stroke="#fff" stroke-width="3.8"/><path d="M9 0v12M0 6h18" stroke="#C8102E" stroke-width="2.2"/>',
  ru: '<rect width="18" height="4" fill="#fff"/><rect y="4" width="18" height="4" fill="#0039A6"/><rect y="8" width="18" height="4" fill="#D52B1E"/>',
  uk: '<rect width="18" height="6" fill="#005BBB"/><rect y="6" width="18" height="6" fill="#FFD500"/>',
  de: '<rect width="18" height="4" fill="#000"/><rect y="4" width="18" height="4" fill="#DD0000"/><rect y="8" width="18" height="4" fill="#FFCE00"/>',
  fr: '<rect width="6" height="12" fill="#0055A4"/><rect x="6" width="6" height="12" fill="#fff"/><rect x="12" width="6" height="12" fill="#EF4135"/>',
  es: '<rect width="18" height="12" fill="#AA151B"/><rect y="3" width="18" height="6" fill="#F1BF00"/>',
  pt: '<rect width="7" height="12" fill="#046A38"/><rect x="7" width="11" height="12" fill="#DA291C"/>',
  it: '<rect width="6" height="12" fill="#009246"/><rect x="6" width="6" height="12" fill="#fff"/><rect x="12" width="6" height="12" fill="#CE2B37"/>',
  pl: '<rect width="18" height="6" fill="#fff"/><rect y="6" width="18" height="6" fill="#DC143C"/>',
  nl: '<rect width="18" height="4" fill="#AE1C28"/><rect y="4" width="18" height="4" fill="#fff"/><rect y="8" width="18" height="4" fill="#21468B"/>',
  sv: '<rect width="18" height="12" fill="#006AA7"/><path d="M5.5 0v12M0 6h18" stroke="#FECC00" stroke-width="2"/>',
  da: '<rect width="18" height="12" fill="#C8102E"/><path d="M5.5 0v12M0 6h18" stroke="#fff" stroke-width="1.8"/>',
  fi: '<rect width="18" height="12" fill="#fff"/><path d="M5.5 0v12M0 6h18" stroke="#002F6C" stroke-width="2.2"/>',
  no: '<rect width="18" height="12" fill="#BA0C2F"/><path d="M5.5 0v12M0 6h18" stroke="#fff" stroke-width="3"/><path d="M5.5 0v12M0 6h18" stroke="#00205B" stroke-width="1.5"/>',
  cs: '<rect width="18" height="6" fill="#fff"/><rect y="6" width="18" height="6" fill="#D7141A"/><path d="M0 0l9 6-9 6z" fill="#11457E"/>',
  sk: '<rect width="18" height="4" fill="#fff"/><rect y="4" width="18" height="4" fill="#0B4EA2"/><rect y="8" width="18" height="4" fill="#EE1C25"/><path d="M7 4.5h4V7c0 1.4-2 2.4-2 2.4S7 8.4 7 7z" fill="#EE1C25" stroke="#fff" stroke-width=".5"/>',
  hu: '<rect width="18" height="4" fill="#CD2A3A"/><rect y="4" width="18" height="4" fill="#fff"/><rect y="8" width="18" height="4" fill="#436F4D"/>',
  ro: '<rect width="6" height="12" fill="#002B7F"/><rect x="6" width="6" height="12" fill="#FCD116"/><rect x="12" width="6" height="12" fill="#CE1126"/>',
  tr: '<rect width="18" height="12" fill="#E30A17"/><circle cx="7.2" cy="6" r="3" fill="#fff"/><circle cx="7.9" cy="6" r="2.4" fill="#E30A17"/><polygon points="11.3,4.7 11.61,5.58 12.54,5.6 11.79,6.16 12.06,7.05 11.3,6.52 10.54,7.05 10.81,6.16 10.06,5.6 10.99,5.58" fill="#fff"/>',
  "zh-CN": '<rect width="18" height="12" fill="#DE2910"/><polygon points="3.2,1.4 3.56,2.5 4.72,2.51 3.79,3.19 4.14,4.29 3.2,3.62 2.26,4.29 2.61,3.19 1.68,2.51 2.84,2.5" fill="#FFDE00"/><circle cx="6.2" cy="1.4" r=".55" fill="#FFDE00"/><circle cx="7.4" cy="2.8" r=".55" fill="#FFDE00"/><circle cx="7.4" cy="4.6" r=".55" fill="#FFDE00"/><circle cx="6.2" cy="6" r=".55" fill="#FFDE00"/>',
  "zh-TW": '<rect width="18" height="12" fill="#FE0000"/><rect width="9" height="6" fill="#000095"/><circle cx="4.5" cy="3" r="1.6" fill="#fff"/><circle cx="4.5" cy="3" r=".5" fill="#000095"/>',
  ja: '<rect width="18" height="12" fill="#fff"/><circle cx="9" cy="6" r="3" fill="#BC002D"/>',
  ko: '<rect width="18" height="12" fill="#fff"/><path d="M5.5 6a3.5 3.5 0 0 1 7 0z" fill="#CD2E3A"/><path d="M5.5 6a3.5 3.5 0 0 0 7 0z" fill="#0047A0"/><path d="M3 2.6l1.8-1.2M3 9.4l1.8 1.2M15 2.6l-1.8-1.2M15 9.4l-1.8 1.2" stroke="#000" stroke-width=".8"/>',
  ar: '<rect width="18" height="12" fill="#006C35"/><rect x="5" y="3" width="8" height="1.8" fill="#fff"/><path d="M3.5 8.5h11" stroke="#fff" stroke-width=".9"/>',
  hi: '<rect width="18" height="4" fill="#FF9933"/><rect y="4" width="18" height="4" fill="#fff"/><rect y="8" width="18" height="4" fill="#138808"/><circle cx="9" cy="6" r="1.1" fill="none" stroke="#000080" stroke-width=".5"/>'
};

function flagMarkup(code) {
  if (!code) return null;
  const key = FLAG_SVGS[code] ? code : String(code).split("-")[0];
  const inner = FLAG_SVGS[key];
  if (!inner) return null;
  return '<svg class="flag-svg" viewBox="0 0 18 12" aria-hidden="true" focusable="false">' + inner + "</svg>";
}

// "auto" keeps the globe emoji (it renders on Windows, unlike flag emoji);
// explicit locales get the SVG above, globe as the last-resort fallback.
function setFlagContent(el, code) {
  if (!el) return;
  if (!code || code === AUTO_LOCALE) {
    el.textContent = "\u{1F310}";
    return;
  }
  const svg = flagMarkup(code);
  if (svg) el.innerHTML = svg;
  else el.textContent = "\u{1F310}";
}
const _localeLowerMap = {};
try {
  for (const entry of LOCALES_LIST) {
    _localeLowerMap[String(entry.code).toLowerCase()] = entry.code;
  }
} catch (e) {}

function normalizeLocale(raw) {
  if (!raw) return null;
  const original = String(raw).replace(/_/g, "-");
  const low = original.toLowerCase();
  if (typeof TRANSLATIONS !== "undefined") {
    if (TRANSLATIONS[original]) return original;
  }
  if (_localeLowerMap[low]) return _localeLowerMap[low];
  // Chinese variants: Traditional -> zh-TW, everything else -> zh-CN
  if (low.startsWith("zh")) {
    if (/tw|hk|hant|mo/.test(low)) return _localeLowerMap["zh-tw"] || "zh-TW";
    return _localeLowerMap["zh-cn"] || "zh-CN";
  }
  const base = low.split("-")[0];
  // Norwegian Bokmål/Nynorsk share the "no" translation
  if (base === "nb" || base === "nn") return _localeLowerMap["no"] || null;
  if (_localeLowerMap[base]) return _localeLowerMap[base];
  // fallback: first locale sharing the same base language
  for (const code of Object.keys(_localeLowerMap)) {
    if (code.split("-")[0] === base) return _localeLowerMap[code];
  }
  return null;
}

async function detectLocale() {
  const candidates = [];
  try {
    if (api?.i18n?.getUILanguage) {
      const v = api.i18n.getUILanguage();
      // Chrome returns a plain string, Firefox may return a Promise
      candidates.push(v && typeof v.then === "function" ? await v : v);
    }
  } catch (e) {}
  try {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
  } catch (e) {}
  for (const c of candidates) {
    const norm = normalizeLocale(c);
    if (norm) return norm;
  }
  return "en";
}

function trTemplate(key) {
  const dict = (typeof TRANSLATIONS !== "undefined" && (TRANSLATIONS[currentLocale] || TRANSLATIONS["en"])) || {};
  const fallback = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS["en"]) || {};
  const text = dict[key] ?? fallback[key] ?? key;
  return typeof text === "string" ? text : String(text);
}

function formatParamValue(v) {
  if (typeof v === "number") {
    try {
      return v.toLocaleString(currentLocale);
    } catch (e) {
      return v.toLocaleString();
    }
  }
  return String(v);
}

// Plain-text version for alert(), title, textContent, etc.
// Strips the <b> markers used by translations, never builds HTML.
function tr(key, params) {
  let text = trTemplate(key);
  text = text.replace(/<\/?b>/g, "");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(formatParamValue(v));
    }
  }
  return text;
}

// Safe rich-text renderer for the message lists. Honors the <b>...</b>
// markers from translations and substitutes {placeholders} using only
// textContent and createElement — no HTML string assignment, so
// attacker-controlled values (cookie names, URLs, error messages)
// can never become markup.
function appendFormattedText(container, key, params) {
  const template = trTemplate(key);
  const parts = template.split(/(<\/?b>|\{[a-zA-Z]+\})/g);
  let bold = false;
  for (const part of parts) {
    if (part === "<b>") {
      bold = true;
    } else if (part === "</b>") {
      bold = false;
    } else if (!part) {
      continue;
    } else {
      const placeholder = /^\{([a-zA-Z]+)\}$/.exec(part);
      const value = placeholder
        ? formatParamValue(params?.[placeholder[1]] ?? part)
        : part;
      if (bold) {
        const b = document.createElement("b");
        b.textContent = value;
        container.appendChild(b);
      } else {
        container.appendChild(document.createTextNode(value));
      }
    }
  }
}

// Animated language switch: fade the column out, swap every text, fade
// back in. Honors prefers-reduced-motion; re-entrant calls (double click)
// fall back to an instant swap so the UI can never get stuck mid-fade.
function applyI18n() {
  const root = document.querySelector(".container-main-screen");
  let reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}
  if (!root || reduce || root.dataset.i18nBusy === "1") {
    doApplyI18n();
    return;
  }
  root.dataset.i18nBusy = "1";
  root.classList.add("locale-switching");
  setTimeout(() => {
    doApplyI18n();
    root.classList.remove("locale-switching");
    delete root.dataset.i18nBusy;
  }, 130);
}

function doApplyI18n() {
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = RTL_LOCALES.includes(currentLocale.split("-")[0]) ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = tr(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.placeholder = tr(key);
  });
  // password fields and the paste area have visual captions only (<small>);
  // mirror them into aria-labels so screen readers name the controls
  for (const [id, key] of [
    ["inp-enc-passwd", "encPlaceholder"],
    ["inp-enc-passwd2", "encConfirmPlaceholder"],
    ["inp-dec-passwd", "decPlaceholder"],
    ["ckz-textarea", "pasteTitle"],
  ]) {
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-label", tr(key));
  }
  // full title on hover: the header shows one truncated line for long locales
  const titleEl = document.querySelector("#header .large-title span[data-i18n]");
  if (titleEl) titleEl.title = titleEl.textContent;
  const picker = document.getElementById("locale-picker");
  if (picker) {
    buildLocaleMenu();
    updateLocaleButton();
  }
  // refresh theme toggle label for the new language
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  updateThemeToggleLabel(theme);
  try {
    updatePasswordToggles();
  } catch (e) {}
  // refresh the picked-file status so a picked name survives the language
  // switch (guarded: cookieFile may still be in TDZ on the very first run)
  try {
    updateDroppedFileName();
  } catch (e) {}
  // re-render the format-dependent export/restore labels for the new language
  try {
    refreshDynamicTexts();
  } catch (e) {}
}

function updateThemeToggleLabel(theme) {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  const label = theme === "dark" ? tr("themeToLight") : tr("themeToDark");
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
}

async function initI18n() {
  let saved = null;
  try {
    saved = (await api.storage.local.get("locale"))?.locale;
  } catch (error) {}
  if (saved === AUTO_LOCALE || saved == null) {
    // default: follow the browser UI language
    localeMode = AUTO_LOCALE;
  } else {
    const norm = normalizeLocale(saved);
    localeMode = norm || AUTO_LOCALE;
    if (!norm) {
      // repair stale/invalid values left by older versions
      try {
        await api.storage.local.set({ locale: AUTO_LOCALE });
      } catch (e) {}
    }
  }
  currentLocale = localeMode === AUTO_LOCALE ? await detectLocale() : localeMode;
  // first paint: swap instantly, no fade delay on popup open
  doApplyI18n();
  wireLocalePicker();
}

function updateLocaleButton() {
  const btn = document.getElementById("locale-button");
  if (!btn) return;
  const isAuto = localeMode === AUTO_LOCALE;
  const flagEl = document.getElementById("locale-flag");
  const curEl = document.getElementById("locale-current");
  if (isAuto) {
    setFlagContent(flagEl, AUTO_LOCALE);
    if (curEl) curEl.textContent = tr("autoOption");
  } else {
    const entry = LOCALES_LIST.find((e) => e.code === currentLocale) || { name: currentLocale };
    setFlagContent(flagEl, currentLocale);
    if (curEl) curEl.textContent = entry.name;
  }
  btn.setAttribute("aria-label", tr("localeLabel"));
  btn.title = isAuto ? tr("autoHint") : tr("localeLabel");
}

function appendLocaleOption(menu, code, nameText, selected) {
  const li = document.createElement("li");
  li.className = "locale-option" + (selected ? " selected" : "");
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", selected ? "true" : "false");
  li.dataset.code = code;
  // roving focus: options are reachable by arrows once the menu is open
  li.tabIndex = -1;
  const flag = document.createElement("span");
  flag.className = "locale-flag";
  flag.setAttribute("aria-hidden", "true");
  setFlagContent(flag, code);
  const name = document.createElement("span");
  name.className = "locale-name";
  name.textContent = nameText;
  li.append(flag, name);
  li.addEventListener("click", () => selectLocale(code));
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectLocale(code);
    }
  });
  menu.appendChild(li);
}

function buildLocaleMenu() {
  const menu = document.getElementById("locale-menu");
  if (!menu) return;
  menu.replaceChildren();
  appendLocaleOption(menu, AUTO_LOCALE, tr("autoOption"), localeMode === AUTO_LOCALE);
  for (const entry of LOCALES_LIST) {
    const selected = localeMode !== AUTO_LOCALE && entry.code === currentLocale;
    appendLocaleOption(menu, entry.code, entry.name, selected);
  }
}

function openLocaleMenu() {
  const menu = document.getElementById("locale-menu");
  const btn = document.getElementById("locale-button");
  if (!menu || !btn) return;
  buildLocaleMenu();
  menu.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
  // move focus into the menu so arrows work immediately
  const items = [...menu.querySelectorAll(".locale-option")];
  const wanted = localeMode === AUTO_LOCALE ? AUTO_LOCALE : currentLocale;
  const current = items.find((li) => li.dataset.code === wanted) || items[0];
  if (current) current.focus();
}

function closeLocaleMenu() {
  const menu = document.getElementById("locale-menu");
  const btn = document.getElementById("locale-button");
  if (!menu || !btn) return;
  menu.classList.add("hidden");
  btn.setAttribute("aria-expanded", "false");
}

function wireLocalePicker() {
  const btn = document.getElementById("locale-button");
  const menu = document.getElementById("locale-menu");
  if (!btn || !menu || btn.dataset.wired === "1") return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("hidden")) openLocaleMenu();
    else closeLocaleMenu();
  });
  // Down/Up on the button opens the menu (Enter/Space click natively)
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openLocaleMenu();
    }
  });
  // listbox keyboard: arrows/Home/End move, Enter/Space is handled per
  // option, Escape closes and returns focus to the button
  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll(".locale-option")];
    if (!items.length) return;
    let i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1 + items.length) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      closeLocaleMenu();
      btn.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!menu.classList.contains("hidden") && !document.getElementById("locale-picker").contains(e.target)) {
      closeLocaleMenu();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.classList.contains("hidden")) {
      closeLocaleMenu();
      btn.focus();
    }
  });
}

async function selectLocale(code) {
  // resolve first: picking the already-active language (or Auto while the
  // detected language is unchanged) must be a no-op — no fade, no rewrite
  let nextMode;
  let nextLocale;
  if (code === AUTO_LOCALE) {
    nextMode = AUTO_LOCALE;
    nextLocale = await detectLocale();
  } else {
    nextMode = normalizeLocale(code) || "en";
    nextLocale = nextMode;
  }
  const changed = nextLocale !== currentLocale || nextMode !== localeMode;
  localeMode = nextMode;
  currentLocale = nextLocale;
  if (changed) {
    try {
      await api.storage.local.set({ locale: localeMode });
    } catch (e) {}
    applyI18n();
  }
  closeLocaleMenu();
  // the menu rebuild above destroys the focused option: park focus back
  try {
    document.getElementById("locale-button").focus();
  } catch (e) {}
}

// null until the user picks a theme manually, then remembered in storage
let savedTheme = null;
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeToggleLabel(theme);
}

async function initTheme() {
  try {
    const res = await api.storage.local.get("theme");
    savedTheme = res?.theme === "dark" || res?.theme === "light" ? res.theme : null;
  } catch (error) {
  }
  // with no stored choice, follow the system theme
  applyTheme(savedTheme || (systemPrefersDark.matches ? "dark" : "light"));
}

// keep following the system theme while the user hasn't picked one
if (typeof systemPrefersDark.addEventListener === "function") {
  systemPrefersDark.addEventListener("change", (e) => {
    if (!savedTheme) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
} else if (typeof systemPrefersDark.addListener === "function") {
  systemPrefersDark.addListener((e) => {
    if (!savedTheme) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  savedTheme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  applyTheme(savedTheme);
  Promise.resolve(api.storage.local.set({ theme: savedTheme })).catch(() => {});
});

initTheme();

initI18n();

// The full UI cannot live in the Firefox action popup: opening the native
// file picker steals the popup's focus and Firefox unloads the popup before
// the file can be read (bug 1292701, still unfixed). So on Firefox the popup
// only shows a button that opens this same UI in a browser tab, where the
// picker works and everything renders centered. Chrome keeps the plain popup.
if (location.search.includes("standalone")) {
  document.body.classList.add("standalone");
} else if (isFirefox) {
  document.querySelector(".container-main-screen").classList.add("hidden");
  document.getElementById("open-tab-wrap").classList.remove("hidden");
  document.getElementById("btn-open-tab").addEventListener("click", () => {
    Promise.resolve(api.tabs.create({ url: api.runtime.getURL("popup.html?standalone=1") }))
      .then(() => window.close())
      .catch(() => {
        // alert() is intentional here: in Firefox popup mode the messages UI
        // is hidden (only #open-tab-wrap is shown), so an inline warning
        // would be invisible
        alert(tr("openTabFail"));
      });
  });
}

document
  .getElementById("restore")
  .addEventListener("change", handleFileSelect, false);

// Declared up-front: wireFilePicker() -> updateDroppedFileName() reads it
// during wiring, which runs before the old declaration site below.
let cookieFile;

// Eye icons as inline SVG (feather-style, same 24x24 geometry for both
// states). Emoji 👁/🙈 have different advance widths on every platform,
// so swapping them resized the button and shoved the password field.
// Declared up-front: updatePasswordToggles() runs during wiring below.
const EYE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

document
  .getElementById("dec-passwd-form")
  .addEventListener("submit", handleDecPasswdSubmit, false);

document
  .getElementById("enc-passwd-form")
  .addEventListener("submit", handleEncPasswdSubmit, false);

document.getElementById("btn-backup").onclick = showEncPasswordInputBox;

document.getElementById("btn-backup-plain").onclick = showPlainExportConfirm;
document.getElementById("btn-plain-export-confirm").onclick = handlePlainBackup;
document.getElementById("btn-plain-export-cancel").onclick = hidePlainExportConfirm;
document.getElementById("btn-plain-restore-confirm").onclick = handlePlainRestore;
document.getElementById("btn-plain-restore-cancel").onclick = cancelPlainRestore;

document.getElementById("btn-upload-fallback").onclick = (e) => {
  if (e) e.preventDefault();
  showFallbackCkzInput();
};

document.getElementById("btn-enc-back").onclick = resetBackupView;
document.getElementById("btn-dec-back").onclick = handleRestoreBack;

wireAboutAndDonate();

wirePasswordToggles();
wireRestoreDropZone();
wireFilePicker();
wireEncSubmitState();
initExportFormat();

// ---- About / Donate modals ----
// Credits (author / based on) live inside the About dialog; social links
// come from the README header, donate details from the README footer.

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("hidden");
  const closeBtn = el.querySelector(".modal .btn-back");
  if (closeBtn) {
    try {
      closeBtn.focus();
    } catch (e) {}
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("hidden");
}

function closeAllModals() {
  closeModal("about-modal");
  closeModal("donate-modal");
}

function fillAboutVersion() {
  try {
    const el = document.getElementById("about-version");
    if (!el) return;
    const manifest = api?.runtime?.getManifest?.();
    if (manifest && manifest.version) {
      el.textContent = "v" + manifest.version;
    }
  } catch (e) {}
}

async function copyDonateCard() {
  const numEl = document.getElementById("donate-card-number");
  const hint = document.getElementById("copy-hint");
  const raw = numEl ? numEl.textContent || "" : "";
  const compact = raw.replace(/\s+/g, "");
  let ok = false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(compact);
      ok = true;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok) {
    // clipboard API unavailable (or denied): select the number so the user
    // can copy it manually with Ctrl+C
    try {
      const range = document.createRange();
      range.selectNodeContents(numEl);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ok = !!(sel && sel.toString());
    } catch (e) {
      ok = false;
    }
  }
  if (hint) {
    hint.textContent = tr("copiedMsg");
    hint.classList.remove("hidden");
  }
}

function wireAboutAndDonate() {
  const btnAbout = document.getElementById("btn-about");
  const btnDonate = document.getElementById("btn-donate");
  if (btnAbout && !btnAbout.dataset.wired) {
    btnAbout.dataset.wired = "1";
    btnAbout.addEventListener("click", () => {
      closeModal("donate-modal");
      fillAboutVersion();
      openModal("about-modal");
    });
  }
  if (btnDonate && !btnDonate.dataset.wired) {
    btnDonate.dataset.wired = "1";
    btnDonate.addEventListener("click", () => {
      closeModal("about-modal");
      const hint = document.getElementById("copy-hint");
      if (hint) hint.classList.add("hidden");
      openModal("donate-modal");
    });
  }
  for (const [closeId, modalId] of [
    ["btn-about-close", "about-modal"],
    ["btn-donate-close", "donate-modal"],
  ]) {
    const btn = document.getElementById(closeId);
    if (btn && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.addEventListener("click", () => closeModal(modalId));
    }
  }
  for (const modalId of ["about-modal", "donate-modal"]) {
    const overlay = document.getElementById(modalId);
    if (overlay && !overlay.dataset.wired) {
      overlay.dataset.wired = "1";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(modalId);
      });
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
  const btnCopy = document.getElementById("btn-copy-card");
  if (btnCopy && !btnCopy.dataset.wired) {
    btnCopy.dataset.wired = "1";
    btnCopy.addEventListener("click", copyDonateCard);
  }
}

async function handleEncPasswdSubmit(e) {
  e.preventDefault();

  const form = document.getElementById("enc-passwd-form");
  if (form.dataset.busy === "1") return;

  // COMPAT: stricter policy applies to NEW backups only. Decrypt path stays
  // lenient (min 3) so old short-password backups keep working.
  let pass = getEncPasswd();
  const pass2El = document.getElementById("inp-enc-passwd2");
  const pass2 = pass2El ? pass2El.value : null;
  if (!pass || pass.length < 8) {
    clearMessages();
    addToWarningMessageList(createWarning("passwordTooShort"));
    return;
  }
  // if the confirm field exists (new UI), it must match; old UI without it
  // keeps working as before (pass2 === null means no confirm field)
  if (pass2 !== null && pass !== pass2) {
    clearMessages();
    addToWarningMessageList(createWarning("passwordMismatch"));
    return;
  }

  form.dataset.busy = "1";
  try {
    clearMessages();

    // promise form works in both browsers; the callback form breaks on Firefox
    // (browser.* ignores the callback and returns a promise instead);
    // callExtensionApi additionally supports old callback-only Chromiums
    let cookies;
    try {
      cookies = await cookiesGetAll({});
    } catch (err) {
      addToWarningMessageList(createWarning("unknownError"));
      return;
    }
    if (!cookies || cookies.length === 0) {
      addToWarningMessageList(createWarning("noCookies"));
      return;
    }
    // COMPAT: iter is stored inside the .ckz payload, so a higher count is
    // still readable by the original extension (old sjcl.decrypt just works
    // slower). Old backups with iter:10000 keep decrypting here untouched.
    const format = getExportFormat();
    const data = encryptCookiesForExport(format, cookies, pass);
    const filename = backupFileNameFull(encryptedSuffixFor(format));
    // show success only if the download actually started (user may cancel
    // the save dialog -> warning only, no misleading success)
    const started = await downloadTextFile(data, filename);
    if (started) backupSuccessAlert(cookies.length)
  } finally {
    // wipe passwords from memory/DOM so they don't linger in the popup
    pass = null;
    clearEncPasswords();
    delete form.dataset.busy;
  }
}

function backupFileNameFull(suffix) {
  // ISO-like stamp: unambiguous across locales and sorts chronologically
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `cookies-${date}-${time}${suffix}`;
}

function backupFileName(ext) {
  return backupFileNameFull("." + ext);
}

// ---- multi-format export/import (serializers live in formats.js) ----
// Every format can be exported with a password (.ckz, encrypted envelope;
// json keeps the legacy direct-array payload) or without one (plain text).

const KNOWN_EXPORT_FORMATS = ["json", "netscape", "header", "puppeteer", "pydict", "csv"];
let exportFormat = "json";
// Picked plain-text backup file, read ahead at pick time: { format, text }
let pendingPlain = null;

function knownFormatOrJson(id) {
  try {
    if (typeof isKnownFormat === "function") return isKnownFormat(id) ? id : "json";
  } catch (e) {}
  return KNOWN_EXPORT_FORMATS.indexOf(id) !== -1 ? id : "json";
}

function getExportFormat() {
  return knownFormatOrJson(exportFormat);
}

function safeShortName(id) {
  try {
    if (typeof formatShortName === "function") return formatShortName(id);
  } catch (e) {}
  return String(id);
}

function safeSerialize(format, cookies) {
  if (typeof formatSerialize === "function") return formatSerialize(format, cookies);
  if (format === "json") return JSON.stringify(cookies, null, 2);
  throw new Error("format support is not available");
}

function safeParse(format, text, opts) {
  if (typeof formatParse === "function") return formatParse(format, text, opts);
  if (format === "json") return JSON.parse(text);
  throw new Error("format support is not available");
}

function safeSniff(text, filename) {
  try {
    if (typeof sniffPlainFormat === "function") return sniffPlainFormat(text, filename);
  } catch (e) {}
  return "json";
}

function plainSuffixFor(format) {
  try {
    if (typeof formatPlainSuffix === "function") return formatPlainSuffix(format);
  } catch (e) {}
  return ".txt";
}

function encryptedSuffixFor(format) {
  try {
    if (typeof formatEncryptedSuffix === "function") return formatEncryptedSuffix(format);
  } catch (e) {}
  return ".ckz";
}

function encryptCookiesForExport(format, cookies, pass) {
  // json keeps the legacy direct-array payload so old extension versions
  // (and old backups) keep working in both directions
  if (format === "json") {
    return sjcl.encrypt(pass, JSON.stringify(cookies), { ks: 256, iter: 100000 });
  }
  const plain = safeSerialize(format, cookies);
  let envelope;
  try {
    if (typeof wrapEncryptedPayload === "function") envelope = wrapEncryptedPayload(format, plain);
  } catch (e) {
    envelope = null;
  }
  if (!envelope) throw new Error("format support is not available");
  return sjcl.encrypt(pass, envelope, { ks: 256, iter: 100000 });
}

function cookiesFromDecrypted(decrypted, fallbackDomain) {
  let unwrapped = null;
  try {
    if (typeof unwrapDecryptedPayload === "function") unwrapped = unwrapDecryptedPayload(decrypted);
  } catch (e) {
    unwrapped = null;
  }
  if (!unwrapped) {
    // not our envelope: try the legacy direct array before giving up
    const legacy = JSON.parse(decrypted);
    if (!Array.isArray(legacy)) throw new Error("invalid backup");
    return legacy;
  }
  if (unwrapped.legacy) return unwrapped.cookies;
  const opts = fallbackDomain ? { fallbackDomain } : undefined;
  return safeParse(unwrapped.format, unwrapped.payload, opts);
}

// Header String / Python Dict carry names+values only, so restoring them
// needs a domain. It comes from these optional inputs; without it such
// cookies are skipped and reported by the restore counters.
function normalizeDomain(v) {
  if (typeof v !== "string") return "";
  return v.trim().replace(/^\.+/, "").toLowerCase();
}

function getRestoreDomain() {
  try {
    const el = document.getElementById("inp-restore-domain");
    return el ? el.value : "";
  } catch (e) {
    return "";
  }
}

function getDecDomain() {
  try {
    const el = document.getElementById("inp-dec-domain");
    return el ? el.value : "";
  } catch (e) {
    return "";
  }
}

function menuFormatOptions() {
  let menu = null;
  try {
    menu = document.getElementById("format-menu");
  } catch (e) {
    menu = null;
  }
  if (!menu || typeof menu.querySelectorAll !== "function") return [];
  try {
    return Array.prototype.slice.call(menu.querySelectorAll(".format-option"));
  } catch (e) {
    return [];
  }
}

function updateFormatToggle() {
  const toggle = document.getElementById("btn-format-toggle");
  const nameEl = document.getElementById("format-toggle-name");
  const short = safeShortName(getExportFormat());
  if (nameEl) nameEl.textContent = short;
  if (toggle) {
    const label = tr("exportTitle") + ": " + short;
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
}

function refreshFormatGrid() {
  const current = getExportFormat();
  for (const option of menuFormatOptions()) {
    const active = !!(option.dataset && option.dataset.format === current);
    if (option.classList && typeof option.classList.toggle === "function") {
      option.classList.toggle("selected", active);
    }
    if (typeof option.setAttribute === "function") {
      option.setAttribute("aria-selected", active ? "true" : "false");
    }
  }
  updateFormatToggle();
  updatePlainExportLabel();
}

function updatePlainExportLabel() {
  const btn = document.getElementById("btn-backup-plain");
  if (!btn) return;
  // {format} is our own short display name (JSON, Netscape, ...), never user data.
  // The button is single-line with ellipsis (see .split-main), so mirror the
  // full text into the tooltip.
  btn.textContent = tr("exportPlainBtn", { format: safeShortName(getExportFormat()) });
  btn.title = btn.textContent;
}

function setExportFormat(id) {
  exportFormat = knownFormatOrJson(id);
  refreshFormatGrid();
  try {
    Promise.resolve(api.storage.local.set({ exportFormat })).catch(() => {});
  } catch (e) {}
}

function isFormatMenuOpen() {
  try {
    const menu = document.getElementById("format-menu");
    return !!(menu && menu.classList && typeof menu.classList.contains === "function"
      && !menu.classList.contains("hidden"));
  } catch (e) {
    return false;
  }
}

function openFormatMenu() {
  const menu = document.getElementById("format-menu");
  const toggle = document.getElementById("btn-format-toggle");
  if (!menu || !toggle) return;
  refreshFormatGrid();
  menu.classList.remove("hidden");
  toggle.setAttribute("aria-expanded", "true");
  const options = menuFormatOptions();
  const current = options.find((li) => li.dataset && li.dataset.format === getExportFormat()) || options[0];
  if (current && typeof current.focus === "function") current.focus();
}

function closeFormatMenu(refocus) {
  const menu = document.getElementById("format-menu");
  const toggle = document.getElementById("btn-format-toggle");
  if (!menu || !toggle) return;
  menu.classList.add("hidden");
  toggle.setAttribute("aria-expanded", "false");
  if (refocus) {
    try {
      toggle.focus();
    } catch (e) {}
  }
}

function wireFormatGrid() {
  const toggle = document.getElementById("btn-format-toggle");
  const menu = document.getElementById("format-menu");
  if (!toggle || !menu || toggle.dataset.wired === "1") return;
  toggle.dataset.wired = "1";
  toggle.addEventListener("click", (e) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    if (isFormatMenuOpen()) closeFormatMenu(false);
    else openFormatMenu();
  });
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      openFormatMenu();
    }
  });
  const pick = (target) => {
    const option = target && target.closest ? target.closest(".format-option") : null;
    if (!option || !option.dataset || !option.dataset.format) return false;
    setExportFormat(option.dataset.format);
    return true;
  };
  menu.addEventListener("click", (e) => {
    if (pick(e.target)) closeFormatMenu(true);
  });
  menu.addEventListener("keydown", (e) => {
    const options = menuFormatOptions();
    if (!options.length) return;
    let i = options.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      options[(i + 1 + options.length) % options.length].focus();
    } else if (e.key === "ArrowUp") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      options[(i - 1 + options.length) % options.length].focus();
    } else if (e.key === "Home") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      options[0].focus();
    } else if (e.key === "End") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      options[options.length - 1].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      if (typeof e.preventDefault === "function") e.preventDefault();
      if (pick(document.activeElement)) closeFormatMenu(true);
    } else if (e.key === "Escape") {
      if (typeof e.stopPropagation === "function") e.stopPropagation();
      closeFormatMenu(true);
    }
  });
  document.addEventListener("click", (e) => {
    if (!isFormatMenuOpen()) return;
    try {
      const wrap = document.querySelector(".split-wrap");
      if (wrap && e.target && typeof wrap.contains === "function" && wrap.contains(e.target)) return;
    } catch (err) {}
    closeFormatMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isFormatMenuOpen()) {
      closeFormatMenu(true);
    }
  });
}

async function initExportFormat() {
  wireFormatGrid();
  try {
    const saved = (await api.storage.local.get("exportFormat"))?.exportFormat;
    if (typeof saved === "string") exportFormat = knownFormatOrJson(saved);
  } catch (e) {}
  refreshFormatGrid();
}

// Re-render the format-dependent labels after a language switch while a
// confirm box is open (called from doApplyI18n, must never throw)
function refreshDynamicTexts() {
  try {
    updatePlainExportLabel();
  } catch (e) {}
  try {
    const exp = document.getElementById("plain-export-confirm");
    if (exp && exp.classList && typeof exp.classList.contains === "function"
        && !exp.classList.contains("hidden")) {
      fillPlainExportText();
    }
  } catch (e) {}
  try {
    const res = document.getElementById("plain-restore-confirm");
    if (res && res.classList && typeof res.classList.contains === "function"
        && !res.classList.contains("hidden")) {
      if (pendingPlain && pendingPlain.format) fillPlainRestoreText(pendingPlain.format);
      else if (isFallbackActive()) fillPlainRestoreText(null);
    }
  } catch (e) {}
}

function showPlainExportConfirm() {
  document.getElementById("btn-backup").style.display = "none";
  document.getElementById("btn-backup-plain").style.display = "none";
  fillPlainExportText();
  document.getElementById("plain-export-confirm").classList.remove("hidden");
}

function hidePlainExportConfirm() {
  document.getElementById("plain-export-confirm").classList.add("hidden");
  const b1 = document.getElementById("btn-backup");
  if (b1) b1.style.display = "";
  const b2 = document.getElementById("btn-backup-plain");
  if (b2) b2.style.display = "";
}

function fillPlainExportText() {
  const el = document.getElementById("plain-export-text");
  if (!el) return;
  el.textContent = tr("plainExportText", { format: safeShortName(getExportFormat()) });
}

function showPlainRestoreConfirm(format) {
  hideDecPasswordInputBox();
  fillPlainRestoreText(format);
  updateRestoreDomainVisibility(format);
  document.getElementById("plain-restore-confirm").classList.remove("hidden");
}

function hidePlainRestoreConfirm() {
  const el = document.getElementById("plain-restore-confirm");
  if (el) el.classList.add("hidden");
}

function fillPlainRestoreText(format) {
  const el = document.getElementById("plain-restore-text");
  if (!el) return;
  if (format) {
    el.textContent = tr("plainRestoreFileText", { format: safeShortName(format) });
  } else {
    el.textContent = tr("plainRestorePasteText");
  }
}

function updateRestoreDomainVisibility(format) {
  const wrap = document.getElementById("restore-domain-wrap");
  if (!wrap || !wrap.classList || typeof wrap.classList.toggle !== "function") return;
  // Header / Python carry names+values only: offer a domain so they can be restored
  const need = !format || format === "header" || format === "pydict";
  wrap.classList.toggle("hidden", !need);
}

// Cancel is a way back: reset the file input so the same file can be picked again
function cancelPlainRestore() {
  hidePlainRestoreConfirm();
  const input = document.getElementById("restore");
  if (input) input.value = "";
  cookieFile = null;
  pendingPlain = null;
  updateDroppedFileName();
  const fb = document.getElementById("btn-upload-fallback");
  if (fb) fb.style.display = "";
}

// ---- back navigation: every sub-screen must have a way back without reload ----

// Backup with password -> back to the export buttons + format grid
function resetBackupView() {
  clearMessages();
  clearEncPasswords();
  document.getElementById("enc-passwd").style.display = "none";
  hidePlainExportConfirm();
}

function isFallbackActive() {
  const wrap = document.getElementById("restore-upload-wrap");
  return !!(wrap && wrap.style.display === "none");
}

// Restore with a picked file -> back to the file picker
function resetRestoreFileState() {
  const input = document.getElementById("restore");
  if (input) input.value = "";
  cookieFile = null;
  pendingPlain = null;
  updateDroppedFileName();
  clearDecPassword();
  hideDecPasswordInputBox();
  hidePlainRestoreConfirm();
  hideDecDomainRow();
  const fb = document.getElementById("btn-upload-fallback");
  if (fb) fb.style.display = "";
  const up = document.getElementById("restore-upload-wrap");
  if (up) up.style.display = "";
}

// Paste-fallback mode -> back to the file picker
function exitFallbackMode() {
  const input = document.getElementById("restore");
  if (input) input.value = "";
  cookieFile = null;
  pendingPlain = null;
  updateDroppedFileName();
  clearDecPassword();
  try {
    document.getElementById("ckz-textarea").value = "";
  } catch (e) {}
  hideDecPasswordInputBox();
  hidePlainRestoreConfirm();
  hideDecDomainRow();
  const ta = document.getElementById("restore-using-text-wrap");
  if (ta) ta.style.display = "none";
  const up = document.getElementById("restore-upload-wrap");
  if (up) up.style.display = "";
  const fb = document.getElementById("btn-upload-fallback");
  if (fb) fb.style.display = "";
}

// Single Back button in the restore form covers both sub-screens:
// paste-fallback and picked-file states.
function handleRestoreBack() {
  clearMessages();
  if (isFallbackActive()) exitFallbackMode();
  else resetRestoreFileState();
}

function hideDecDomainRow() {
  const wrap = document.getElementById("dec-domain-wrap");
  if (wrap && wrap.classList && typeof wrap.classList.add === "function") {
    wrap.classList.add("hidden");
  }
}

// An encrypted Header/Python backup carries names+values only: offer the
// domain field up-front when the filename already tells the inner format
// (cookies-...-header.ckz / -pydict.ckz). A renamed file still restores,
// its domain-less cookies are just skipped and reported.
function revealDecDomainIfLossy(lowerName) {
  const wrap = document.getElementById("dec-domain-wrap");
  if (!wrap || !wrap.classList || typeof wrap.classList.toggle !== "function") return;
  const lossy = lowerName.indexOf("-header.ckz") !== -1 || lowerName.indexOf("-pydict.ckz") !== -1;
  wrap.classList.toggle("hidden", !lossy);
}

async function handlePlainBackup() {
  clearMessages();

  const format = getExportFormat();
  let cookies;
  try {
    cookies = await cookiesGetAll({});
  } catch (err) {
    addToWarningMessageList(createWarning("unknownError"));
    return;
  }
  if (!cookies || cookies.length === 0) {
    addToWarningMessageList(createWarning("noCookies"));
    return;
  }
  // plain text: human-readable, NO password, NO encryption.
  // The insecure-box above already warned the user before this runs.
  let data;
  try {
    data = safeSerialize(format, cookies);
  } catch (err) {
    addToWarningMessageList(createWarning("unknownError"));
    return;
  }
  if (!data || !data.trim()) {
    addToWarningMessageList(createWarning("noCookies"));
    return;
  }
  const filename = backupFileNameFull(plainSuffixFor(format));
  const started = await downloadTextFile(data, filename);
  if (started) backupSuccessAlert(cookies.length);
}

function handlePlainRestore() {
  clearMessages();
  const finish = async (text, formatHint) => {
    if (typeof text !== "string" || !text.trim()) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }
    // same size guard as the .ckz path: never parse gigabytes
    const dataBytes = utf8ByteLength(text);
    if (dataBytes > MAX_BACKUP_BYTES) {
      addToWarningMessageList(createWarning("fileTooLarge", { size: formatByteSize(dataBytes) }));
      return;
    }
    const format = formatHint || safeSniff(text, cookieFile && cookieFile.name);
    const fallbackDomain = normalizeDomain(getRestoreDomain());
    let cookies;
    try {
      cookies = safeParse(format, text, fallbackDomain ? { fallbackDomain } : undefined);
    } catch (error) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }
    if (!Array.isArray(cookies)) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }
    if (cookies.length === 0) {
      addToWarningMessageList(createWarning("emptyBackup"));
      return;
    }
    await restoreCookies(cookies);
    // collapse back to the picker so a second click cannot re-submit
    if (isFallbackActive()) exitFallbackMode();
    else cancelPlainRestore();
  };
  if (pendingPlain && typeof pendingPlain.text === "string") {
    finish(pendingPlain.text, pendingPlain.format);
  } else {
    getBackupFileDataAsText((data) => {
      finish(data, null);
    });
  }
}

function handleFileSelect(e) {
  handlePickedBackupFile(e.target.files && e.target.files[0]);
}

function isEncryptedBackupName(lowerName) {
  return lowerName.endsWith(".ckz");
}

function isSupportedBackupName(lowerName) {
  return isEncryptedBackupName(lowerName)
    || lowerName.endsWith(".json")
    || lowerName.endsWith(".txt")
    || lowerName.endsWith(".js")
    || lowerName.endsWith(".cjs")
    || lowerName.endsWith(".mjs")
    || lowerName.endsWith(".py")
    || lowerName.endsWith(".csv");
}

// Shared by the file input and drag&drop: same validation, same UI.
// Takes a File (or null) instead of an event so both sources behave 1:1.
function handlePickedBackupFile(file) {
  cookieFile = file || null;
  pendingPlain = null;
  const input = document.getElementById("restore");
  if (!cookieFile) {
    hideDecPasswordInputBox();
    hidePlainRestoreConfirm();
    hideDecDomainRow();
    clearDecPassword();
    updateDroppedFileName();
    return;
  }
  const name = String(cookieFile.name || "").toLowerCase();
  if (isEncryptedBackupName(name)) {
    hideFallbackCkzButton();
    hidePlainRestoreConfirm();
    revealDecDomainIfLossy(name);
    showDecPasswordInputBox();
    updateDroppedFileName();
    return;
  }
  if (!isSupportedBackupName(name)) {
    // inline warning (not alert) so a drop doesn't get stuck behind a modal
    addToWarningMessageList(createWarning("notBackupFile"));
    if (input) input.value = "";
    cookieFile = null;
    hideDecPasswordInputBox();
    hidePlainRestoreConfirm();
    hideDecDomainRow();
    updateDroppedFileName();
    return;
  }
  hideFallbackCkzButton();
  hideDecPasswordInputBox();
  hideDecDomainRow();
  clearDecPassword();
  updateDroppedFileName();
  preparePlainFileRestore(cookieFile);
}

// Plain-text files are sniffed at pick time so the confirm box can name the
// detected format; the text is kept for the confirm button (no second read).
function preparePlainFileRestore(file) {
  try {
    if (file && typeof file.size === "number" && file.size > MAX_BACKUP_BYTES) {
      addToWarningMessageList(createWarning("fileTooLarge", { size: formatByteSize(file.size) }));
      const input = document.getElementById("restore");
      if (input) input.value = "";
      cookieFile = null;
      updateDroppedFileName();
      return;
    }
  } catch (e) {}
  let reader = null;
  try {
    reader = new FileReader();
  } catch (e) {
    reader = null;
  }
  if (!reader) {
    // should not happen in the popup: fall back to sniffing at confirm time
    showPlainRestoreConfirm(null);
    return;
  }
  reader.onload = (e) => {
    // the user may have picked another file while this one was reading
    if (cookieFile !== file) return;
    const text = e.target ? e.target.result : null;
    if (typeof text !== "string" || !text) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }
    if (utf8ByteLength(text) > MAX_BACKUP_BYTES) {
      addToWarningMessageList(createWarning("fileTooLarge", { size: formatByteSize(utf8ByteLength(text)) }));
      return;
    }
    const format = safeSniff(text, file.name);
    pendingPlain = { format, text };
    showPlainRestoreConfirm(format);
  };
  reader.onerror = () => {
    addToWarningMessageList(createWarning("readError"));
  };
  try {
    reader.readAsText(file);
  } catch (e) {
    addToWarningMessageList(createWarning("readError"));
  }
}

// Shows the picked file name in the custom status line next to the
// "Choose file" button (the native input is visually hidden, so the browser
// never renders its own unstyled "No file chosen" text). Falls back to the
// localized "no file" text when nothing is picked.
function updateDroppedFileName() {
  const status = document.getElementById("picked-file-status");
  if (!status) return;
  const file = cookieFile || null;
  if (file && file.name) {
    status.textContent = file.name;
    status.title = file.name;
    status.classList.remove("text-muted");
  } else {
    status.textContent = tr("noFileChosen");
    status.title = "";
    status.classList.add("text-muted");
  }
}

// The native file input is visually hidden (see .file-input-hidden): the
// label above acts as the visible button. Labels aren't keyboard-focusable,
// so Enter/Space is wired by hand to open the dialog.
function wireFilePicker() {
  const label = document.getElementById("restore-picker-label");
  const input = document.getElementById("restore");
  if (!label || !input || label.dataset.wired === "1") return;
  label.dataset.wired = "1";
  label.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  updateDroppedFileName();
}

// Drag&drop onto the restore upload box. Reuses handlePickedBackupFile, so
// a dropped file goes through exactly the same path as a dialog-picked one.
function wireRestoreDropZone() {
  const zone = document.getElementById("restore-upload-wrap");
  if (!zone || zone.dataset.dropWired === "1") return;
  zone.dataset.dropWired = "1";
  let depth = 0;
  const allowCopy = (e) => {
    e.preventDefault();
    try {
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    } catch (err) {}
  };
  zone.addEventListener("dragenter", (e) => {
    allowCopy(e);
    depth++;
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragover", allowCopy);
  zone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    depth = Math.max(0, depth - 1);
    if (depth === 0) zone.classList.remove("dragover");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    depth = 0;
    zone.classList.remove("dragover");
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || files.length === 0) return;
    // if several files were dropped, prefer the first supported backup one
    let picked = files[0];
    for (let i = 0; i < files.length; i++) {
      const n = String(files[i].name || "").toLowerCase();
      if (isSupportedBackupName(n)) {
        picked = files[i];
        break;
      }
    }
    // reflect the drop in the native input when possible (best-effort:
    // restore works from cookieFile either way)
    try {
      const input = document.getElementById("restore");
      if (input && typeof DataTransfer === "function") {
        const dt = new DataTransfer();
        dt.items.add(picked);
        input.files = dt.files;
      }
    } catch (err) {}
    handlePickedBackupFile(picked);
  });
  // a missed FILE drop must never navigate the popup / standalone tab away
  // (dropping a .csv onto the tab would otherwise replace the UI).
  // Non-file drags (e.g. selected text into the paste textarea) are left
  // alone so the browser handles them natively.
  document.addEventListener("dragover", (e) => {
    if (hasDroppedFiles(e)) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    if (hasDroppedFiles(e)) e.preventDefault();
  });
}

// True when the drag carries files. Unknown -> true (safe default: block a
// potential navigation); plain text selections report text/plain and pass.
function hasDroppedFiles(e) {
  try {
    const types = e.dataTransfer && e.dataTransfer.types;
    if (!types) return true;
    return Array.prototype.includes.call(types, "Files");
  } catch (err) {
    return true;
  }
}

function handleDecPasswdSubmit(e) {
  e.preventDefault();

  const pass = getDecPasswd()
  if (!pass) {
    return;
  }

  clearMessages();
  // pre-validation before the expensive PBKDF2: rejects garbage without
  // burning 100k iterations and avoids misleading "wrong password"
  const precheck = precheckBackupPayload();
  if (!precheck.ok) {
    if (precheck.reason === "too-large") {
      addToWarningMessageList(createWarning("fileTooLarge", { size: precheck.size }));
    } else {
      addToWarningMessageList(createWarning("invalidFile"));
    }
    clearDecPassword();
    return;
  }

  getBackupFileDataAsText(async (data) => {
    // re-check the actual content (file could have changed / textarea edited)
    if (!isPlausibleCkzPayload(data)) {
      addToWarningMessageList(createWarning("invalidFile"));
      clearDecPassword();
      return;
    }
    let decrypted;
    try {
      decrypted = sjcl.decrypt(pass, data)
    } catch (error) {
      // COMPAT: decrypt path untouched — old iter:10000 backups decrypt here.
      // Inline warnings instead of alert() so the popup doesn't lose focus.
      if (error instanceof sjcl.exception.corrupt) {
        addToWarningMessageList(createWarning("wrongPassword"));
      } else if (error instanceof sjcl.exception.invalid) {
        addToWarningMessageList(createWarning("invalidFile"));
      } else {
        addToWarningMessageList(createWarning("unknownError"));
      }
      clearDecPassword();
      return;
    }

    // the .ckz envelope holds any export format (json stays a legacy
    // direct array); Header/Python payloads need the optional domain below
    let cookies;
    try {
      cookies = cookiesFromDecrypted(decrypted, normalizeDomain(getDecDomain()));
    } catch (error) {
      addToWarningMessageList(createWarning("invalidFile"));
      clearDecPassword();
      return;
    }

    if (!Array.isArray(cookies)) {
      addToWarningMessageList(createWarning("invalidFile"));
      clearDecPassword();
      return;
    }
    if (cookies.length === 0) {
      addToWarningMessageList(createWarning("emptyBackup"));
      clearDecPassword();
      return;
    }

    await restoreCookies(cookies);
    // success: collapse back to the file picker so a second Enter cannot
    // re-submit the same backup; the summary message stays visible.
    // (resetRestoreFileState also wipes the decryption password)
    resetRestoreFileState();
  })
}

// ---- compat-safe pre-validation (no format change) ----
// Kept in sync with MAX_DOWNLOAD_BYTES in background.js (see its comment).
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

// Byte length of a string, not UTF-16 units: cookie values and pasted
// payloads can hold multibyte characters, and the limits above are bytes.
function utf8ByteLength(s) {
  if (typeof s !== "string") return 0;
  // fast path: every char is at most 4 bytes, so short strings fit for sure
  if (s.length <= MAX_BACKUP_BYTES / 4) return s.length;
  try {
    return new TextEncoder().encode(s).length;
  } catch (e) {
    return s.length * 3; // conservative upper bound, never under-reports
  }
}

function formatByteSize(n) {
  if (typeof n !== "number" || !isFinite(n) || n < 0) return String(n);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// SJCL payload is a JSON object with iv/ct/salt — never an array/string.
// This check is format-preserving: it only rejects what decrypt would reject.
function isPlausibleCkzPayload(data) {
  if (typeof data !== "string" || !data) return false;
  if (utf8ByteLength(data) > MAX_BACKUP_BYTES) return false;
  const trimmed = data.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
  try {
    const obj = JSON.parse(trimmed);
    return !!obj && typeof obj === "object" && !Array.isArray(obj)
      && typeof obj.iv === "string" && typeof obj.ct === "string";
  } catch (e) {
    return false;
  }
}

// Fast check on file size / textarea length before doing PBKDF2 work
function precheckBackupPayload() {
  try {
    if (typeof cookieFile !== "undefined" && cookieFile && typeof cookieFile.size === "number") {
      if (cookieFile.size > MAX_BACKUP_BYTES) {
        return { ok: false, reason: "too-large", size: formatByteSize(cookieFile.size) };
      }
      // non-empty small files still need the content check after reading
      return { ok: true };
    }
  } catch (e) {}
  try {
    const text = getCkzFileContentsFromTextarea();
    if (text && utf8ByteLength(text) > MAX_BACKUP_BYTES) {
      return { ok: false, reason: "too-large", size: formatByteSize(utf8ByteLength(text)) };
    }
  } catch (e) {}
  return { ok: true };
}

// One cookie, several increasingly lenient ways to store it. The first
// attempt preserves the backup 1:1; later ones drop or coerce only the bits
// Chromium rejects while Firefox tolerates: a cookie store id from another
// browser, SameSite=None without Secure, and the __Host-/__Secure- prefix
// rules. Redundant attempts are deduplicated.
function buildRestoreAttempts(base, cookie, host) {
  const attempts = [];
  const seen = new Set();
  const push = (details) => {
    // stable dedup key: JSON.stringify with an array replacer only filters
    // keys instead of ordering them, so build the key by hand
    const key = Object.keys(details).sort().map((k) => k + "=" + String(details[k])).join("|");
    if (!seen.has(key)) {
      seen.add(key);
      attempts.push(details);
    }
  };

  // 1:1 with the backup
  push({ ...base });

  // cookie stores are per browser/profile ("firefox-default" vs "0"): an
  // unknown storeId rejects the whole set, so retry in the default store
  let current = { ...base };
  if (current.storeId !== undefined) {
    const { storeId, ...noStore } = current;
    current = { ...noStore };
    push(current);
  }

  // Chromium rejects SameSite=None without Secure (Firefox historically
  // allows it): retry with the default policy instead of losing the cookie
  if (current.sameSite === "no_restriction" && current.secure !== true) {
    const { sameSite, ...noSameSite } = current;
    current = { ...noSameSite };
    push(current);
  }

  // partitioned (CHIPS) cookies need partitionKey, but only where the
  // browser understands it — retry without it instead of losing the cookie
  if (current.partitionKey !== undefined) {
    const { partitionKey, ...noPartition } = current;
    current = { ...noPartition };
    push(current);
  }

  // __Host- / __Secure- prefixed names have extra rules in Chromium
  const name = cookie && typeof cookie.name === "string" ? cookie.name : "";
  if (name.startsWith("__Host-")) {
    const coerced = {
      url: "https://" + host + "/",
      name: current.name,
      value: current.value,
      path: "/",
      secure: true
    };
    if (current.httpOnly !== undefined) coerced.httpOnly = current.httpOnly;
    if (current.expirationDate !== undefined) coerced.expirationDate = current.expirationDate;
    if (current.sameSite !== undefined) coerced.sameSite = current.sameSite;
    // keep the cookie in its store/container/partition when the prefix was
    // the only problem
    if (current.storeId !== undefined) coerced.storeId = current.storeId;
    if (current.partitionKey !== undefined) coerced.partitionKey = current.partitionKey;
    if (current.firstPartyDomain !== undefined) coerced.firstPartyDomain = current.firstPartyDomain;
    push(coerced);
  } else if (name.startsWith("__Secure-") && current.secure !== true) {
    const coercedPath = typeof current.path === "string" ? current.path : "/";
    push({ ...current, secure: true, url: "https://" + host + coercedPath });
  }

  return attempts;
}

// How many cookies.set calls may be in flight at once. A strictly sequential
// restore of thousands of cookies is slow; the attempts chain of one cookie
// stays sequential (fallbacks must be tried in order), cookies run in parallel.
const RESTORE_CONCURRENCY = 6;

async function restoreCookies(cookies) {
  // initialize progress bar
  initRestoreProgressBar(cookies.length);

  let total = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  const epoch = new Date().getTime() / 1000;

  // cookie stores are per browser/profile: a backup made in another browser
  // carries store ids that do not exist here (see buildRestoreAttempts)
  const validStoreIds = await getCookieStoreIds();

  const restoreOne = async (cookie) => {
    if (!cookie || typeof cookie.name !== "string" || typeof cookie.value !== "string") {
      skipped++;
      return;
    }
    const domain = typeof cookie.domain === "string" ? cookie.domain : "";
    const path = typeof cookie.path === "string" ? cookie.path : "/";
    if (!domain) {
      skipped++;
      return;
    }
    const host = domain.startsWith(".") ? domain.slice(1) : domain;
    let url;
    try {
      // encodeURI saves paths with spaces/unicode; new URL rejects bad hosts.
      // encodeURI leaves "#" and "?" untouched — they would turn the path
      // into a fragment/query, so escape them by hand.
      url = "http" + (cookie.secure ? "s" : "") + "://" + host
        + encodeURI(path).replace(/#/g, "%23").replace(/\?/g, "%3F");
      new URL(url);
    } catch (e) {
      skipped++;
      unknownErrWarning(cookie.name, host);
      return;
    }

    // cookies bigger than ~4KB are rejected by cookies.set in every browser:
    // skip early with the same message instead of burning all attempts
    if (utf8ByteLength(cookie.name) + utf8ByteLength(cookie.value) > 4096) {
      skipped++;
      unknownErrWarning(cookie.name, host);
      return;
    }

    // expirationDate must be a number: Firefox writes null for session
    // cookies and foreign backups may carry anything; a non-number would
    // fail the comparison below and then be rejected by cookies.set
    const expirationDate = typeof cookie.expirationDate === "number" ? cookie.expirationDate : null;
    if (expirationDate && epoch > expirationDate) {
      expirationWarning(cookie.name, url);
      skipped++;
      return;
    }

    // cookies.set accepts only a fixed set of fields; everything else
    // (hostOnly, session, firstPartyDomain, partitionKey, ...) is rejected
    const details = {
      url: url,
      name: cookie.name,
      value: cookie.value,
      path: path,
    };
    if (cookie.hostOnly !== true && domain) {
      // if the cookie is hostOnly, we don't supply the domain
      details.domain = domain;
    }
    // if session is true (or a Firefox-made backup has expirationDate: null),
    // then expirationDate needs to be omitted
    if (cookie.session !== true && expirationDate != null) {
      details.expirationDate = expirationDate;
    }
    if (cookie.secure != null) details.secure = Boolean(cookie.secure);
    if (cookie.httpOnly != null) details.httpOnly = Boolean(cookie.httpOnly);
    // the sameSite enums differ between the two browsers
    if (typeof cookie.sameSite === "string") {
      let sameSite = cookie.sameSite;
      if (sameSite === "lax_plus") sameSite = "lax";
      else if (sameSite === "strict_plus") sameSite = "strict";
      if (isFirefox) {
        // Firefox only accepts these three, "unspecified"/others must be omitted
        if (["no_restriction", "lax", "strict"].includes(sameSite)) {
          details.sameSite = sameSite;
        }
      } else if (["no_restriction", "lax", "strict", "unspecified"].includes(sameSite)) {
        details.sameSite = sameSite;
      }
    }
    if (typeof cookie.storeId === "string" && cookie.storeId) {
      // unknown here = from another browser/profile, still tried first and
      // then retried without it (see buildRestoreAttempts)
      if (!validStoreIds || validStoreIds.has(cookie.storeId)) {
        details.storeId = cookie.storeId;
      }
    }
    // Firefox containers: without firstPartyDomain a container cookie is
    // silently restored into the default container
    if (isFirefox && typeof cookie.firstPartyDomain === "string" && cookie.firstPartyDomain) {
      details.firstPartyDomain = cookie.firstPartyDomain;
    }
    // CHIPS: without partitionKey a partitioned cookie restores unpartitioned
    if (!isFirefox && cookie.partitionKey && typeof cookie.partitionKey === "object"
        && typeof cookie.partitionKey.topLevelSite === "string" && cookie.partitionKey.topLevelSite) {
      details.partitionKey = { topLevelSite: cookie.partitionKey.topLevelSite };
    }

    let restored = false;
    let lastError = null;
    for (const attempt of buildRestoreAttempts(details, cookie, host)) {
      try {
        // resolves to the cookie in Chrome (MV3 promises) and Firefox (browser.* promises)
        const set = await cookiesSet(attempt);
        if (set != null) {
          restored = true;
          break;
        }
        lastError = new Error("cookies.set returned no cookie");
      } catch (error) {
        lastError = error;
      }
    }

    if (restored) {
      total++;
    } else {
      failed++;
      // the user-facing message stays localizable and short; the technical
      // reason goes to the console for bug reports (capped: a huge backup
      // with thousands of bad cookies must not flood the console)
      if (failed <= 20) {
        try {
          console.warn("Cookie restore failed:", cookie.name, url, lastError && (lastError.message || lastError));
        } catch (e) {}
      }
      unknownErrWarning(cookie.name, url);
    }
  };

  let next = 0;
  const worker = async () => {
    while (next < cookies.length) {
      const i = next++;
      await restoreOne(cookies[i]);
      // progress counts every processed cookie, not just successes
      processed++;
      updateRestoreProgressBar(processed);
    }
  };
  const workers = [];
  for (let w = 0; w < Math.min(RESTORE_CONCURRENCY, cookies.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  if (failed > 20) {
    try {
      console.warn("Cookie restore failed: ...and", failed - 20, "more (see warnings above)");
    } catch (e) {}
  }

  // update messages: restored + skipped + failed always add up to total
  restoreSuccessAlert(total, cookies.length, skipped, failed);

  // hide progress bar
  hideRestoreProgressBar();
}

// NOTE: most of these methods are shallow, but i wanted to separate application logic from the DOM
function makeDismissable(div) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "alert-close";
  btn.textContent = "\u00d7";
  btn.setAttribute("aria-label", tr("dismissLabel"));
  btn.title = tr("dismissLabel");
  btn.addEventListener("click", () => div.remove());
  div.appendChild(btn);
  return div;
}

function createWarning(key, params) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-warning");
  const span = document.createElement("span");
  appendFormattedText(span, key, params);
  div.appendChild(span);
  div.dataset.alertKey = String(key);
  div.dataset.alertText = span.textContent;
  return makeDismissable(div);
}

function createSuccessAlert(key, params) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-success");
  const span = document.createElement("span");
  appendFormattedText(span, key, params);
  div.appendChild(span);
  div.dataset.alertKey = String(key);
  div.dataset.alertText = span.textContent;
  return makeDismissable(div);
}

function unknownErrWarning(cookieName, cookieUrl) {
  if (cookieName && cookieUrl) {
    addToWarningMessageList(createWarning("cookieRestoreFail", { name: cookieName, url: cookieUrl }))
  }
}

function expirationWarning(cookieName, cookieUrl) {
  if (cookieName && cookieUrl) {
    addToWarningMessageList(createWarning("cookieExpired", { name: cookieName, url: cookieUrl }))
  }
}

function backupSuccessAlert(totalCookies) {
  const count = typeof totalCookies === "number" ? totalCookies : Number(totalCookies) || 0;
  addToSuccessMessageList(createSuccessAlert("backupSuccess", { count }))
}

function restoreSuccessAlert(restoredCookies, totalCookies, skippedCookies, failedCookies) {
  const skipped = Number(skippedCookies) || 0;
  const failed = Number(failedCookies) || 0;
  const params = { restored: restoredCookies, total: totalCookies };
  let key = "restoreSuccess";
  if (failed > 0) {
    key = "restoreSuccessFailed";
    params.skipped = skipped;
    params.failed = failed;
  } else if (skipped > 0) {
    key = "restoreSuccessSkipped";
    params.skipped = skipped;
  }
  // zero restored is not a success: same text, warning style
  const node = Number(restoredCookies) === 0
    ? createWarning(key, params)
    : createSuccessAlert(key, params);
  addToSuccessMessageList(node);
}

function hideBackupButton() {
  document.getElementById("btn-backup").style.display = "none";
}

function showEncPasswordInputBox(e) {
  hideBackupButton()
  document.getElementById("btn-backup-plain").style.display = "none";
  document.getElementById("plain-export-confirm").classList.add("hidden");
  document.getElementById("enc-passwd").style.display = "flex";
  updateEncSubmitState();
  // activate the input box
  document.getElementById("inp-enc-passwd").focus();
}

function showDecPasswordInputBox(e) {
  document.getElementById("dec-passwd").style.display = "flex";
  document.getElementById("inp-dec-passwd").focus()
}

function hideDecPasswordInputBox(e) {
  document.getElementById("dec-passwd").style.display = "none";
}

function addToSuccessMessageList(node) {
  const list = document.getElementById("messages");
  // dedupe: never stack two identical alerts from one action (double submit, retries)
  const id = node.dataset.alertText;
  if (id) {
    for (const child of list.children) {
      if (child.dataset && child.dataset.alertText === id) return;
    }
  }
  list.appendChild(node)
}

function addToWarningMessageList(node) {
  const list = document.getElementById("warnings");
  const id = node.dataset.alertText;
  if (id) {
    for (const child of list.children) {
      if (child.dataset && child.dataset.alertText === id) return;
    }
  }
  list.appendChild(node)
}

function clearMessages() {
  document.getElementById("messages").replaceChildren();
  document.getElementById("warnings").replaceChildren();
}

function getEncPasswd() {
  return document.getElementById("inp-enc-passwd").value;
}

function getDecPasswd() {
  return document.getElementById("inp-dec-passwd").value;
}

// Wipe password fields so secrets don't linger in the popup DOM
function clearEncPasswords() {
  for (const id of ["inp-enc-passwd", "inp-enc-passwd2"]) {
    try {
      const el = document.getElementById(id);
      if (el) el.value = "";
    } catch (e) {}
  }
  updateEncSubmitState();
}

// The backup Enter highlights only when BOTH password fields hold the same
// suitable password (min 8 chars). Pure CSS :valid can't express "both match",
// so the state is mirrored into a .ready class on the submit button.
function updateEncSubmitState() {
  const btn = document.getElementById("btn-enc-submit");
  if (!btn) return;
  let ready = false;
  try {
    const p1 = document.getElementById("inp-enc-passwd");
    const p2 = document.getElementById("inp-enc-passwd2");
    if (p1 && p2) {
      const v1 = p1.value || "";
      const v2 = p2.value || "";
      ready = v1.length >= 8 && v2 !== "" && v1 === v2;
    }
  } catch (e) {
    ready = false;
  }
  btn.classList.toggle("ready", ready);
}

function wireEncSubmitState() {
  for (const id of ["inp-enc-passwd", "inp-enc-passwd2"]) {
    const el = document.getElementById(id);
    if (!el || el.dataset.readyWired === "1") continue;
    el.dataset.readyWired = "1";
    el.addEventListener("input", updateEncSubmitState);
  }
  updateEncSubmitState();
}

function clearDecPassword() {
  try {
    const el = document.getElementById("inp-dec-passwd");
    if (el) el.value = "";
  } catch (e) {}
}

// Show/hide toggles: UI-only, never touch the stored value or the .ckz format
function wirePasswordToggles() {
  for (const [btnId, inputIds] of [
    ["toggle-enc-passwd", ["inp-enc-passwd", "inp-enc-passwd2"]],
    ["toggle-dec-passwd", ["inp-dec-passwd"]],
  ]) {
    const btn = document.getElementById(btnId);
    if (!btn || btn.dataset.wired === "1") continue;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      const first = inputIds.map((id) => document.getElementById(id)).find(Boolean);
      if (!first) return;
      const show = first.type === "password";
      for (const id of inputIds) {
        try {
          const el = document.getElementById(id);
          if (el) el.type = show ? "text" : "password";
        } catch (e) {}
      }
      updatePasswordToggles();
      try {
        first.focus();
      } catch (e) {}
    });
  }
  updatePasswordToggles();
}

function updatePasswordToggles() {
  // label follows the current state (shown -> offer to hide)
  for (const [btnId, inputId] of [
    ["toggle-enc-passwd", "inp-enc-passwd"],
    ["toggle-dec-passwd", "inp-dec-passwd"],
  ]) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) continue;
    const shown = input.type !== "password";
    const label = shown ? tr("hidePassword") : tr("showPassword");
    btn.setAttribute("aria-label", label);
    btn.title = label;
    // same-size SVG either way: the button box never changes, the field
    // next to it stays put (our own static strings only)
    btn.innerHTML = shown ? EYE_OFF_SVG : EYE_SVG;
  }
}

function initRestoreProgressBar(maxVal) {
  document.getElementById("progress").style.display = "block";
  const bar = document.getElementById("progressbar");
  bar.setAttribute("max", maxVal);
  bar.setAttribute("value", 0);
}

function updateRestoreProgressBar(val) {
  document.getElementById("progressbar").setAttribute("value", val);
}

function hideRestoreProgressBar() {
  document.getElementById("progressbar").setAttribute("value", 0);
  document.getElementById("progress").style.display = "none";
}

function hideFallbackCkzButton() {
  document.getElementById("btn-upload-fallback").style.display = "none"
}

function showFallbackCkzInput() {
  hideFallbackCkzButton()
  document.getElementById("restore-upload-wrap").style.display = "none"
  // show the fallback
  document.getElementById("restore-using-text-wrap").style.display = "flex"
  document.getElementById("dec-passwd").style.display = "flex";
  // pasted plain text (any format) uses the same textarea, so offer the
  // password-less restore path too; the format is sniffed at click time
  pendingPlain = null;
  fillPlainRestoreText(null);
  updateRestoreDomainVisibility(null);
  document.getElementById("plain-restore-confirm").classList.remove("hidden");
}

function getCkzFileContentsFromTextarea() {
  const v = document.getElementById("ckz-textarea").value;
  if (!v) return v;
  // avoid duplicating a huge paste in memory when there is nothing to trim
  const t = v.trim();
  return t.length === v.length ? v : t;
}

// Chrome's extension APIs were callback-only for a long time and return
// promises only in recent versions; Firefox's browser.* APIs are promise-only
// and ignore the callback argument. This helper accepts both forms: if the
// call returns a thenable it is awaited, otherwise the callback fires and
// runtime.lastError (read synchronously inside it) decides the outcome.
function callExtensionApi(owner, name, ...args) {
  return callExtensionApiWithTimeout(owner, name, args, 10000);
}

function callExtensionApiWithTimeout(owner, name, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!owner || typeof owner[name] !== "function") {
      reject(new Error("API not available: " + String(name)));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("API call timed out: " + String(name)));
      }
    }, timeoutMs);
    const settleOk = (value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value === undefined ? null : value);
      }
    };
    const settleErr = (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const callback = (result) => {
      let lastError = null;
      try {
        lastError = api && api.runtime && api.runtime.lastError ? api.runtime.lastError : null;
      } catch (e) {
        lastError = null;
      }
      if (lastError) {
        settleErr(new Error(lastError.message || String(lastError)));
      } else {
        settleOk(result);
      }
    };
    let maybe;
    try {
      maybe = owner[name].apply(owner, [...args, callback]);
    } catch (error) {
      settleErr(error);
      return;
    }
    if (maybe && typeof maybe.then === "function") {
      maybe.then(settleOk, settleErr);
    }
    // otherwise the callback above settles the promise (or the timer fires)
  });
}

function cookiesGetAll(filter) {
  return callExtensionApi(api.cookies, "getAll", filter);
}

function cookiesSet(details) {
  return callExtensionApi(api.cookies, "set", details);
}

// Known cookie store ids of this browser/profile ("0" in Chromium,
// "firefox-default" in Firefox). A backup made in another browser carries a
// storeId that does not exist here and every cookies.set with it is rejected,
// so callers drop it. Null = unknown, keep the stored value on first attempt.
async function getCookieStoreIds() {
  try {
    if (!api.cookies || typeof api.cookies.getAllCookieStores !== "function") {
      return null;
    }
    const stores = await callExtensionApi(api.cookies, "getAllCookieStores");
    if (Array.isArray(stores)) {
      return new Set(stores.map((s) => s && s.id).filter(Boolean));
    }
  } catch (error) {}
  return null;
}

// Single download path: the actual downloads.download call lives in
// background.js, which owns the blob/data: URL and the onChanged cleanup.
// That matters because the popup can close while the saveAs dialog is open —
// a listener created here would die with it, while the background outlives
// the dialog. This function only forwards the payload and reports the
// outcome, keeping the boolean contract of callers (true = download started).
async function downloadTextFile(data, filename) {
  let res;
  try {
    res = await sendDownloadRequest(data, filename);
  } catch (error) {
    const msg = error?.message || String(error);
    addToWarningMessageList(createWarning("downloadFailed", { error: msg }))
    return false;
  }
  if (res && res.ok) {
    return true;
  }
  const msg = (res && res.error) || "unknown";
  addToWarningMessageList(createWarning("downloadRejected", { msg }))
  return false;
}

function sendDownloadRequest(data, filename) {
  // the saveAs dialog can stay open for a while, so this call gets a longer
  // timeout than the default 10s used for instant API calls above
  return callExtensionApiWithTimeout(
    api.runtime,
    "sendMessage",
    [{ type: "downloadBackup", data: data, filename: filename }],
    120000
  );
}

function getBackupFileDataAsText(cb) {
  if (cookieFile) {
    const reader = new FileReader();
    reader.readAsText(cookieFile);
    reader.onload = (e) => {
      cb(e.target.result);
    }
    reader.onerror = () => {
      addToWarningMessageList(createWarning("readError"));
    }
  } else {
    cb(getCkzFileContentsFromTextarea())
  }
}


