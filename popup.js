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
const RTL_LOCALES = ["ar"];
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

function detectLocale() {
  const candidates = [];
  try {
    if (api?.i18n?.getUILanguage) candidates.push(api.i18n.getUILanguage());
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
  const select = document.getElementById("locale-select");
  if (select) {
    if (!select.options.length) {
      for (const entry of LOCALES_LIST) {
        const opt = document.createElement("option");
        opt.value = entry.code;
        opt.textContent = entry.name;
        select.appendChild(opt);
      }
    }
    select.value = currentLocale;
    const label = tr("localeLabel");
    select.setAttribute("aria-label", label);
    select.title = label;
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
  try {
    const res = await api.storage.local.get("locale");
    const saved = normalizeLocale(res?.locale);
    currentLocale = saved || detectLocale();
  } catch (error) {
    currentLocale = detectLocale();
  }
  applyI18n();
  const select = document.getElementById("locale-select");
  if (select) {
    select.addEventListener("change", async () => {
      const norm = normalizeLocale(select.value) || "en";
      currentLocale = norm;
      try {
        await api.storage.local.set({ locale: currentLocale });
      } catch (e) {}
      applyI18n();
    });
  }
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

document.getElementById("btn-upload-fallback").onclick = (e) => {
  if (e) e.preventDefault();
  showFallbackCkzInput();
};

async function handleEncPasswdSubmit(e) {
  e.preventDefault();

  const pass = getEncPasswd();
  if (!pass || pass.length < 3) {
    return;
  }

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
    // only using en-GB because it puts the date first
    const d = new Date()
    const date = d.toLocaleDateString("en-GB").replace(/\//g, "-");
    const time = d.toLocaleTimeString("en-GB").replace(/:/g, "-");
    const filename = `cookies-${date}-${time}.ckz`;
    downloadJson(data, filename)
    backupSuccessAlert(cookies.length)
  } else {
    alert(tr("noCookies"));
  }
}

let cookieFile;

function handleFileSelect(e) {
  cookieFile = e.target.files[0];
  if (!cookieFile || !cookieFile.name.toLowerCase().endsWith(".ckz")) {
    alert(tr("notCkz"));
    e.target.value = "";
    cookieFile = null;
    hideDecPasswordInputBox()
    return;
  }
  hideFallbackCkzButton()
  showDecPasswordInputBox()
}

function handleDecPasswdSubmit(e) {
  e.preventDefault();

  const pass = getDecPasswd()
  if (!pass) {
    return;
  }

  getCkzFileDataAsText(async (data) => {
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
  })
}

// NOTE: most of these methods are shallow, but i wanted to separate application logic from the DOM
function createWarning(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-warning");
  div.innerHTML = text;
  return div;
}

function createSuccessAlert(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-success");
  div.innerHTML = text;
  return div;
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
  document.getElementById("messages").appendChild(node)
}

function addToWarningMessageList(node) {
  document.getElementById("warnings").appendChild(node)
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
      return;
    }
    if (!res || !res.ok) {
      addToWarningMessageList(createWarning(tr("downloadFailed", { error: res?.error || tr("unknownError") })));
    }
    return;
  }

  if (!api.downloads || !api.downloads.download) {
    addToWarningMessageList(createWarning(tr("noDownloadsApi")))
    alert(tr("noDownloadsApi"));
    return;
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
    return;
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
    return;
  }

  if (downloadId == null) {
    const msg = "download returned no id";
    addToWarningMessageList(createWarning(tr("downloadFailed", { error: msg })))
    return;
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
}

function getCkzFileDataAsText(cb) {
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
