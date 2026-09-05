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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tr(key, params) {
  const dict = (typeof TRANSLATIONS !== "undefined" && (TRANSLATIONS[currentLocale] || TRANSLATIONS["en"])) || {};
  const fallback = (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS["en"]) || {};
  let text = dict[key] ?? fallback[key] ?? key;
  if (typeof text !== "string") return String(text);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      let val = v;
      if (typeof v === "number") {
        try {
          val = v.toLocaleString(currentLocale);
        } catch (e) {
          val = v.toLocaleString();
        }
      } else {
        // params are interpolated into innerHTML alerts, so escape them:
        // cookie names/URLs come from the backup file and are attacker-controlled
        val = escapeHtml(val);
      }
      text = text.split(`{${k}}`).join(String(val));
    }
  }
  return text;
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

async function handleEncPasswdSubmit(e) {
  e.preventDefault();

  const form = document.getElementById("enc-passwd-form");
  if (form.dataset.busy === "1") return;

  const pass = getEncPasswd();
  if (!pass || pass.length < 3) {
    return;
  }

  form.dataset.busy = "1";
  try {
    clearMessages();

    // promise form works in both browsers; the callback form breaks on Firefox
    // (browser.* ignores the callback and returns a promise instead)
    let cookies;
    try {
      cookies = await api.cookies.getAll({});
    } catch (err) {
      addToWarningMessageList(createWarning(tr("unknownError")));
      return;
    }
    if (cookies.length > 0) {
      const data = sjcl.encrypt(pass, JSON.stringify(cookies), { ks: 256 });
      const filename = backupFileName("ckz");
      // show success only if the download actually started (user may cancel
      // the save dialog -> warning only, no misleading success)
      const started = await downloadJson(data, filename);
      if (started) backupSuccessAlert(cookies.length)
    } else {
      alert(tr("noCookies"));
    }
  } finally {
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
}

async function handleJsonBackup() {
  clearMessages();

  let cookies;
  try {
    cookies = await api.cookies.getAll({});
  } catch (err) {
    addToWarningMessageList(createWarning(tr("unknownError")));
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
  cookieFile = e.target.files[0];
  if (!cookieFile) {
    hideDecPasswordInputBox()
    hideJsonRestoreConfirm()
    return;
  }
  const name = cookieFile.name.toLowerCase();
  if (name.endsWith(".json")) {
    hideFallbackCkzButton()
    showJsonRestoreConfirm()
    return;
  }
  if (!name.endsWith(".ckz")) {
    alert(tr("notBackupFile"));
    e.target.value = "";
    cookieFile = null;
    hideDecPasswordInputBox()
    hideJsonRestoreBox()
    return;
  }
  hideFallbackCkzButton()
  hideJsonRestoreBox()
  showDecPasswordInputBox()
}

function handleDecPasswdSubmit(e) {
  e.preventDefault();

  const pass = getDecPasswd()
  if (!pass) {
    return;
  }

  clearMessages();
  getBackupFileDataAsText(async (data) => {
    let cookies;

    try {
      const decrypted = sjcl.decrypt(pass, data)
      cookies = JSON.parse(decrypted);
    } catch (error) {
      if (error instanceof sjcl.exception.corrupt) {
        alert(tr("wrongPassword"));
      } else if (error instanceof sjcl.exception.invalid) {
        alert(tr("invalidFile"));
      } else {
        alert(tr("unknownError"));
      }
      return;
    }

    if (!Array.isArray(cookies)) {
      alert(tr("invalidFile"));
      return;
    }

    await restoreCookies(cookies);
  })
}

async function restoreCookies(cookies) {
  // initialize progress bar
  initRestoreProgressBar(cookies.length)

  let total = 0;

  // lets save some syscalls by defining it once up here
  // if i call it in the loop, its not gonna be very slow but hey,
  // whose that concerned about that much accuracy of cookie expriation dates
  const epoch = new Date().getTime() / 1000;

  for (const cookie of cookies) {
    if (!cookie || typeof cookie.name !== "string" || typeof cookie.value !== "string") {
      continue;
    }
    const domain = typeof cookie.domain === "string" ? cookie.domain : "";
    const path = typeof cookie.path === "string" ? cookie.path : "/";
    if (!domain) {
      continue;
    }
    let url =
      "http" +
      (cookie.secure ? "s" : "") +
      "://" +
      (domain.startsWith(".") ? domain.slice(1) : domain) +
      path;

    // Firefox writes "expirationDate: null" for session cookies, so guard before comparing
    if (cookie.expirationDate && epoch > cookie.expirationDate) {
      expirationWarning(cookie.name, url)
      continue;
    }

    // cookies.set accepts only a fixed set of fields; everything else
    // (hostOnly, session, storeId, firstPartyDomain, partitionKey, ...) is rejected
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
      details.storeId = cookie.storeId;
    }

    let c = null;
    try {
      // resolves to the cookie in Chrome (MV3 promises) and Firefox (browser.* promises)
      c = await api.cookies.set(details);
    } catch (error) {
      c = null;
    }

    if (c == null) {
      unknownErrWarning(cookie.name, url)
    } else {
      total++;
      updateRestoreProgressBar(total)
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

function createWarning(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-warning");
  div.dataset.html = text;
  div.innerHTML = text;
  return makeDismissable(div);
}

function createSuccessAlert(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-success");
  div.dataset.html = text;
  div.innerHTML = text;
  return makeDismissable(div);
}

function unknownErrWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(createWarning(tr("cookieRestoreFail", { name: cookie_name, url: cookie_url })))
  }
}

function expirationWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(createWarning(tr("cookieExpired", { name: cookie_name, url: cookie_url })))
  }
}

function backupSuccessAlert(totalCookies) {
  const count = typeof totalCookies === "number" ? totalCookies : Number(totalCookies) || 0;
  addToSuccessMessageList(createSuccessAlert(tr("backupSuccess", { count })))
}

function restoreSuccessAlert(restoredCookies, totalCookies) {
  addToSuccessMessageList(createSuccessAlert(tr("restoreSuccess", { restored: restoredCookies, total: totalCookies })));
}

function hideBackupButton() {
  document.getElementById("btn-backup").style.display = "none";
}

function showEncPasswordInputBox(e) {
  hideBackupButton()
  document.getElementById("btn-backup-json").style.display = "none";
  document.getElementById("json-export-confirm").classList.add("hidden");
  document.getElementById("enc-passwd").style.display = "flex";
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
  const html = node.dataset.html;
  if (html && list.querySelector(`[data-html="${CSS.escape(html)}"]`)) return;
  list.appendChild(node)
}

function addToWarningMessageList(node) {
  const list = document.getElementById("warnings");
  const html = node.dataset.html;
  if (html && list.querySelector(`[data-html="${CSS.escape(html)}"]`)) return;
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

// the MV3 background can be asleep; the first sendMessage can then lose the
// race against the listener registration in it, retry a few times
async function sendMessageWithRetry(msg) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await api.runtime.sendMessage(msg);
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

async function downloadJson(data, filename) {
  if (isFirefox) {
    // Firefox rejects data: URLs in downloads.download ("Access denied"), so
    // a blob: URL is needed, but it must be created by the background script:
    // blob URLs are revoked together with the document that created them, and
    // the popup closes on its first focus loss (the save dialog closes it),
    // revoking the URL before the downloader reads it -> "Failed".
    let res;
    try {
      res = await sendMessageWithRetry({
        type: "downloadBackup",
        data: data,
        filename: filename
      });
    } catch (error) {
      addToWarningMessageList(createWarning(tr("downloadFailed", { error: error?.message || error })));
      return false;
    }
    if (!res || !res.ok) {
      addToWarningMessageList(createWarning(tr("downloadFailed", { error: res?.error || tr("unknownError") })));
      return false;
    }
    return true;
  }

  if (!api.downloads || !api.downloads.download) {
    addToWarningMessageList(createWarning(tr("noDownloadsApi")))
    alert(tr("noDownloadsApi"));
    return false;
  }

  const blob = new Blob([data], { type: "application/octet-stream" });

  let url;
  try {
    // Chrome blocks blob: downloads started from extension pages
    // ("Failed - Extension"), so use a data: URL there. A data: URL is just a
    // string, it doesn't depend on the popup staying alive.
    url = await readAsDataURL(blob);
  } catch (error) {
    addToWarningMessageList(createWarning(tr("prepareFailed", { error: error?.message || error })))
    return false;
  }

  const options = {
    url: url,
    filename: filename,
    conflictAction: "uniquify",
    saveAs: true
  };

  let downloadId;
  try {
    downloadId = await api.downloads.download(options);
  } catch (error) {
    const msg = error?.message || error;
    addToWarningMessageList(createWarning(tr("downloadRejected", { msg })))
    return false;
  }

  if (downloadId == null) {
    const msg = "download returned no id";
    addToWarningMessageList(createWarning(tr("downloadFailed", { error: msg })))
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
    } else if (delta?.state?.current == "interrupted") {
      const msg = delta?.error?.current || "unknown";
      addToWarningMessageList(createWarning(tr("downloadInterrupted", { msg })))
      api.downloads.onChanged.removeListener(listener);
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
