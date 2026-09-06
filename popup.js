// works on both Chrome and Firefox: Firefox exposes `browser`, Chrome exposes `chrome`
const isFirefox = typeof browser !== "undefined";
const api = isFirefox ? browser : chrome;

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
// flags shown in the custom language menu (native <select> can't render them)
const LOCALE_FLAGS = {
  en: "\u{1F1EC}\u{1F1E7}",
  ru: "\u{1F1F7}\u{1F1FA}",
  uk: "\u{1F1FA}\u{1F1E6}",
  de: "\u{1F1E9}\u{1F1EA}",
  fr: "\u{1F1EB}\u{1F1F7}",
  es: "\u{1F1EA}\u{1F1F8}",
  pt: "\u{1F1F5}\u{1F1F9}",
  it: "\u{1F1EE}\u{1F1F9}",
  pl: "\u{1F1F5}\u{1F1F1}",
  nl: "\u{1F1F3}\u{1F1F1}",
  sv: "\u{1F1F8}\u{1F1EA}",
  da: "\u{1F1E9}\u{1F1F0}",
  fi: "\u{1F1EB}\u{1F1EE}",
  no: "\u{1F1F3}\u{1F1F4}",
  cs: "\u{1F1E8}\u{1F1FF}",
  sk: "\u{1F1F8}\u{1F1F0}",
  hu: "\u{1F1ED}\u{1F1FA}",
  ro: "\u{1F1F7}\u{1F1F4}",
  tr: "\u{1F1F9}\u{1F1F7}",
  "zh-CN": "\u{1F1E8}\u{1F1F3}",
  "zh-TW": "\u{1F1F9}\u{1F1FC}",
  ja: "\u{1F1EF}\u{1F1F5}",
  ko: "\u{1F1F0}\u{1F1F7}",
  ar: "\u{1F1F8}\u{1F1E6}",
  hi: "\u{1F1EE}\u{1F1F3}"
};

function localeFlag(code) {
  if (!code) return "\u{1F310}";
  return LOCALE_FLAGS[code] || LOCALE_FLAGS[String(code).split("-")[0]] || "\u{1F310}";
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

function applyI18n() {
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
  applyI18n();
  wireLocalePicker();
}

function updateLocaleButton() {
  const btn = document.getElementById("locale-button");
  if (!btn) return;
  const isAuto = localeMode === AUTO_LOCALE;
  const flagEl = document.getElementById("locale-flag");
  const curEl = document.getElementById("locale-current");
  if (isAuto) {
    if (flagEl) flagEl.textContent = "🌐";
    if (curEl) curEl.textContent = tr("autoOption");
  } else {
    const entry = LOCALES_LIST.find((e) => e.code === currentLocale) || { name: currentLocale };
    if (flagEl) flagEl.textContent = localeFlag(currentLocale);
    if (curEl) curEl.textContent = entry.name;
  }
  btn.setAttribute("aria-label", tr("localeLabel"));
  btn.title = isAuto ? tr("autoHint") : tr("localeLabel");
}

function appendLocaleOption(menu, code, flagText, nameText, selected) {
  const li = document.createElement("li");
  li.className = "locale-option" + (selected ? " selected" : "");
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", selected ? "true" : "false");
  li.dataset.code = code;
  const flag = document.createElement("span");
  flag.className = "locale-flag";
  flag.setAttribute("aria-hidden", "true");
  flag.textContent = flagText;
  const name = document.createElement("span");
  name.className = "locale-name";
  name.textContent = nameText;
  li.append(flag, name);
  li.addEventListener("click", () => selectLocale(code));
  menu.appendChild(li);
}

function buildLocaleMenu() {
  const menu = document.getElementById("locale-menu");
  if (!menu) return;
  menu.replaceChildren();
  appendLocaleOption(menu, AUTO_LOCALE, "🌐", tr("autoOption"), localeMode === AUTO_LOCALE);
  for (const entry of LOCALES_LIST) {
    const selected = localeMode !== AUTO_LOCALE && entry.code === currentLocale;
    appendLocaleOption(menu, entry.code, localeFlag(entry.code), entry.name, selected);
  }
}

function openLocaleMenu() {
  const menu = document.getElementById("locale-menu");
  const btn = document.getElementById("locale-button");
  if (!menu || !btn) return;
  buildLocaleMenu();
  menu.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
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
  if (code === AUTO_LOCALE) {
    localeMode = AUTO_LOCALE;
    try {
      await api.storage.local.set({ locale: AUTO_LOCALE });
    } catch (e) {}
    currentLocale = await detectLocale();
  } else {
    const norm = normalizeLocale(code) || "en";
    localeMode = norm;
    currentLocale = norm;
    try {
      await api.storage.local.set({ locale: currentLocale });
    } catch (e) {}
  }
  applyI18n();
  closeLocaleMenu();
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
        alert(tr("openTabFail"));
      });
  });
}

document
  .getElementById("restore")
  .addEventListener("change", handleFileSelect, false);

document
  .getElementById("dec-passwd-form")
  .addEventListener("submit", handleDecPasswdSubmit, false);

document
  .getElementById("enc-passwd-form")
  .addEventListener("submit", handleEncPasswdSubmit, false);

document.getElementById("btn-backup").onclick = showEncPasswordInputBox;

document.getElementById("btn-backup-json").onclick = showJsonExportWarning;
document.getElementById("btn-json-export-confirm").onclick = handleJsonBackup;
document.getElementById("btn-json-export-cancel").onclick = hideJsonExportWarning;
document.getElementById("btn-json-restore-confirm").onclick = handleJsonRestore;
document.getElementById("btn-json-restore-cancel").onclick = hideJsonRestoreConfirm;

document.getElementById("btn-upload-fallback").onclick = (e) => {
  if (e) e.preventDefault();
  showFallbackCkzInput();
};

wirePasswordToggles();
wireRestoreDropZone();
wireEncSubmitState();

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
  // keeps working as before
  if (pass2 !== null && pass2 !== "" && pass !== pass2) {
    clearMessages();
    addToWarningMessageList(createWarning("passwordMismatch"));
    return;
  }
  if (pass2 !== null && pass2 === "") {
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
    if (cookies.length > 0) {
      // COMPAT: iter is stored inside the .ckz payload, so a higher count is
      // still readable by the original extension (old sjcl.decrypt just works
      // slower). Old backups with iter:10000 keep decrypting here untouched.
      const data = sjcl.encrypt(pass, JSON.stringify(cookies), { ks: 256, iter: 100000 });
      const filename = backupFileName("ckz");
      // show success only if the download actually started (user may cancel
      // the save dialog -> warning only, no misleading success)
      const started = await downloadJson(data, filename);
      if (started) backupSuccessAlert(cookies.length)
    } else {
      alert(tr("noCookies"));
    }
  } finally {
    // wipe passwords from memory/DOM so they don't linger in the popup
    pass = null;
    clearEncPasswords();
    delete form.dataset.busy;
  }
}

let cookieFile;

function backupFileName(ext) {
  // only using en-GB because it puts the date first
  const d = new Date()
  const date = d.toLocaleDateString("en-GB").replace(/\//g, "-");
  const time = d.toLocaleTimeString("en-GB").replace(/:/g, "-");
  return `cookies-${date}-${time}.${ext}`;
}

function showJsonExportWarning() {
  document.getElementById("btn-backup-json").style.display = "none";
  document.getElementById("json-export-confirm").classList.remove("hidden");
}

function hideJsonExportWarning() {
  document.getElementById("json-export-confirm").classList.add("hidden");
  document.getElementById("btn-backup-json").style.display = "";
}

function showJsonRestoreConfirm() {
  hideDecPasswordInputBox();
  document.getElementById("json-restore-confirm").classList.remove("hidden");
}

function hideJsonRestoreBox() {
  document.getElementById("json-restore-confirm").classList.add("hidden");
}

function hideJsonRestoreConfirm() {
  hideJsonRestoreBox();
  // reset the file input so the user can pick the same file again if needed
  const input = document.getElementById("restore");
  if (input) input.value = "";
  cookieFile = null;
  updateDroppedFileName();
}

async function handleJsonBackup() {
  clearMessages();

  let cookies;
  try {
    cookies = await cookiesGetAll({});
  } catch (err) {
    addToWarningMessageList(createWarning("unknownError"));
    return;
  }
  if (!cookies || cookies.length === 0) {
    alert(tr("noCookies"));
    return;
  }
  // plain JSON: human-readable, NO password, NO encryption.
  // The insecure-box above already warned the user before this runs.
  const data = JSON.stringify(cookies, null, 2);
  const filename = backupFileName("json");
  const started = await downloadJson(data, filename);
  if (started) backupSuccessAlert(cookies.length);
}

function handleJsonRestore() {
  clearMessages();
  getBackupFileDataAsText(async (data) => {
    if (!data) {
      alert(tr("invalidFile"));
      return;
    }
    let cookies;
    try {
      cookies = JSON.parse(data);
    } catch (error) {
      alert(tr("invalidFile"));
      return;
    }
    if (!Array.isArray(cookies)) {
      alert(tr("invalidFile"));
      return;
    }
    // extra safety: a .ckz payload is a JSON object/string, never an array,
    // so an array here really is a plain-JSON backup
    await restoreCookies(cookies);
  });
}

function handleFileSelect(e) {
  handlePickedBackupFile(e.target.files && e.target.files[0]);
}

// Shared by the file input and drag&drop: same validation, same UI.
// Takes a File (or null) instead of an event so both sources behave 1:1.
function handlePickedBackupFile(file) {
  cookieFile = file || null;
  const input = document.getElementById("restore");
  if (!cookieFile) {
    hideDecPasswordInputBox()
    hideJsonRestoreConfirm()
    clearDecPassword();
    updateDroppedFileName();
    return;
  }
  const name = String(cookieFile.name || "").toLowerCase();
  if (name.endsWith(".json")) {
    hideFallbackCkzButton()
    showJsonRestoreConfirm()
    updateDroppedFileName();
    return;
  }
  if (!name.endsWith(".ckz")) {
    // inline warning (not alert) so a drop doesn't get stuck behind a modal
    addToWarningMessageList(createWarning("notBackupFile"));
    if (input) input.value = "";
    cookieFile = null;
    hideDecPasswordInputBox()
    hideJsonRestoreBox()
    updateDroppedFileName();
    return;
  }
  hideFallbackCkzButton()
  hideJsonRestoreBox()
  showDecPasswordInputBox()
  updateDroppedFileName();
}

// Shows the picked file name under the input. The native input shows it too
// when the file came from the dialog; for drops the input sync is
// best-effort (see wireRestoreDropZone), so this label is the reliable one.
function updateDroppedFileName() {
  const label = document.getElementById("dropped-file-name");
  if (!label) return;
  const file = typeof cookieFile !== "undefined" ? cookieFile : null;
  if (file && file.name) {
    label.textContent = file.name;
    label.title = file.name;
    label.classList.remove("hidden");
  } else {
    label.textContent = "";
    label.title = "";
    label.classList.add("hidden");
  }
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
    // if several files were dropped, prefer the first .ckz/.json one
    let picked = files[0];
    for (let i = 0; i < files.length; i++) {
      const n = String(files[i].name || "").toLowerCase();
      if (n.endsWith(".ckz") || n.endsWith(".json")) {
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
  // a missed drop must never navigate the popup / standalone tab away
  // (dropping a .json onto the tab would otherwise replace the UI)
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => e.preventDefault());
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
    return;
  }

  getBackupFileDataAsText(async (data) => {
    // re-check the actual content (file could have changed / textarea edited)
    if (!isPlausibleCkzPayload(data)) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }
    let cookies;

    try {
      const decrypted = sjcl.decrypt(pass, data)
      cookies = JSON.parse(decrypted);
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
      return;
    }

    if (!Array.isArray(cookies)) {
      addToWarningMessageList(createWarning("invalidFile"));
      return;
    }

    await restoreCookies(cookies);
    // wipe the decryption password after a successful restore
    clearDecPassword();
  })
}

// ---- compat-safe pre-validation (no format change) ----
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

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
  if (data.length > MAX_BACKUP_BYTES) return false;
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
    if (text && text.length > MAX_BACKUP_BYTES) {
      return { ok: false, reason: "too-large", size: formatByteSize(text.length) };
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
    const key = JSON.stringify(details, Object.keys(details).sort());
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
    push(coerced);
  } else if (name.startsWith("__Secure-") && current.secure !== true) {
    const coercedPath = typeof current.path === "string" ? current.path : "/";
    push({ ...current, secure: true, url: "https://" + host + coercedPath });
  }

  return attempts;
}

async function restoreCookies(cookies) {
  // initialize progress bar
  initRestoreProgressBar(cookies.length)

  let total = 0;

  // lets save some syscalls by defining it once up here
  // if i call it in the loop, its not gonna be very slow but hey,
  // whose that concerned about that much accuracy of cookie expriation dates
  const epoch = new Date().getTime() / 1000;

  // cookie stores are per browser/profile: a backup made in another browser
  // carries store ids that do not exist here (see buildRestoreAttempts)
  const validStoreIds = await getCookieStoreIds();

  for (const cookie of cookies) {
    if (!cookie || typeof cookie.name !== "string" || typeof cookie.value !== "string") {
      continue;
    }
    const domain = typeof cookie.domain === "string" ? cookie.domain : "";
    const path = typeof cookie.path === "string" ? cookie.path : "/";
    if (!domain) {
      continue;
    }
    const host = domain.startsWith(".") ? domain.slice(1) : domain;
    let url =
      "http" +
      (cookie.secure ? "s" : "") +
      "://" +
      host +
      path;

    // Firefox writes "expirationDate: null" for session cookies, so guard before comparing
    if (cookie.expirationDate && epoch > cookie.expirationDate) {
      expirationWarning(cookie.name, url)
      continue;
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
    if (cookie.session !== true && cookie.expirationDate != null) {
      details.expirationDate = cookie.expirationDate;
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
      updateRestoreProgressBar(total)
    } else {
      // the user-facing message stays localizable and short; the technical
      // reason goes to the console for bug reports
      try {
        console.warn("Cookie restore failed:", cookie.name, url, lastError && (lastError.message || lastError));
      } catch (e) {}
      unknownErrWarning(cookie.name, url)
    }
  }

  // update messages
  restoreSuccessAlert(total, cookies.length)

  // hide progress bar
  hideRestoreProgressBar()
}

// NOTE: most of these methods are shallow, but i wanted to separate application logic from the DOM
function makeDismissable(div) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "alert-close";
  btn.textContent = "\u00d7";
  btn.setAttribute("aria-label", "\u00d7");
  btn.title = "\u00d7";
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

function unknownErrWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(createWarning("cookieRestoreFail", { name: cookie_name, url: cookie_url }))
  }
}

function expirationWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(createWarning("cookieExpired", { name: cookie_name, url: cookie_url }))
  }
}

function backupSuccessAlert(totalCookies) {
  const count = typeof totalCookies === "number" ? totalCookies : Number(totalCookies) || 0;
  addToSuccessMessageList(createSuccessAlert("backupSuccess", { count }))
}

function restoreSuccessAlert(restoredCookies, totalCookies) {
  addToSuccessMessageList(createSuccessAlert("restoreSuccess", { restored: restoredCookies, total: totalCookies }));
}

function hideBackupButton() {
  document.getElementById("btn-backup").style.display = "none";
}

function showEncPasswordInputBox(e) {
  hideBackupButton()
  document.getElementById("btn-backup-json").style.display = "none";
  document.getElementById("json-export-confirm").classList.add("hidden");
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
    // keep the eye meaningful without extra i18n churn
    btn.textContent = shown ? "🙈" : "👁";
  }
}

function initRestoreProgressBar(maxVal) {
  document.getElementById("progress").style.display = "block";
  document.getElementById("progressbar").setAttribute("max", maxVal);
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
  // plain-JSON paste uses the same textarea, so offer the insecure restore path too
  document.getElementById("json-restore-confirm").classList.remove("hidden");
}

function getCkzFileContentsFromTextarea() {
  return document.getElementById("ckz-textarea").value.trim()
}

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Chrome's extension APIs were callback-only for a long time and return
// promises only in recent versions; Firefox's browser.* APIs are promise-only
// and ignore the callback argument. This helper accepts both forms: if the
// call returns a thenable it is awaited, otherwise the callback fires and
// runtime.lastError (read synchronously inside it) decides the outcome.
function callExtensionApi(owner, name, ...args) {
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
    }, 10000);
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

function downloadsDownload(options) {
  return callExtensionApi(api.downloads, "download", options);
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

async function downloadJson(data, filename) {
  if (!api.downloads || !api.downloads.download) {
    addToWarningMessageList(createWarning("noDownloadsApi"))
    alert(tr("noDownloadsApi"));
    return false;
  }

  let url = null;
  let isBlobUrl = false;
  try {
    const blob = new Blob([data], { type: "application/octet-stream" });
    if (isFirefox) {
      // The full UI runs in a tab on Firefox (see the standalone mode above),
      // so this document outlives the save dialog and a blob URL created here
      // stays valid. Downloading here also avoids the MV3 background, which
      // has no URL.createObjectURL, while Firefox rejects data: URLs.
      url = URL.createObjectURL(blob);
      isBlobUrl = true;
    } else {
      // Chrome blocks blob: downloads started from extension pages
      // ("Failed - Extension"), so use a data: URL there. A data: URL is just a
      // string, it doesn't depend on the popup staying alive.
      url = await readAsDataURL(blob);
    }
  } catch (error) {
    addToWarningMessageList(createWarning("prepareFailed", { error: error?.message || error }))
    return false;
  }

  const revoke = () => {
    if (isBlobUrl && url) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
      url = null;
    }
  };

  const options = {
    url: url,
    filename: filename,
    conflictAction: "uniquify",
    saveAs: true
  };

  let downloadId;
  try {
    downloadId = await downloadsDownload(options);
  } catch (error) {
    revoke();
    const msg = error?.message || error;
    addToWarningMessageList(createWarning("downloadRejected", { msg }))
    return false;
  }

  if (downloadId == null) {
    revoke();
    const msg = "download returned no id";
    addToWarningMessageList(createWarning("downloadFailed", { error: msg }))
    return false;
  }

  const listener = (delta) => {
    if (delta?.id != downloadId) {
      return;
    }
    if (delta?.state?.current == "complete") {
      try {
        const shown = api.downloads.show(downloadId);
        if (shown && typeof shown.catch === "function") shown.catch(() => {});
      } catch (e) {}
      api.downloads.onChanged.removeListener(listener);
      revoke();
    } else if (delta?.state?.current == "interrupted") {
      const msg = delta?.error?.current || "unknown";
      addToWarningMessageList(createWarning("downloadInterrupted", { msg }))
      api.downloads.onChanged.removeListener(listener);
      revoke();
    }
  };
  api.downloads.onChanged.addListener(listener);
  return true;
}

function getBackupFileDataAsText(cb) {
  if (cookieFile) {
    const reader = new FileReader();
    reader.readAsText(cookieFile);
    reader.onload = (e) => {
      cb(e.target.result);
    }
    reader.onerror = () => {
      alert(tr("readError"));
    }
  } else {
    cb(getCkzFileContentsFromTextarea())
  }
}

// legacy name, kept for compatibility
function getCkzFileDataAsText(cb) {
  return getBackupFileDataAsText(cb);
}
