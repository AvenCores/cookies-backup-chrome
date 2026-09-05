// works on both Chrome and Firefox: Firefox exposes `browser`, Chrome exposes `chrome`
const isFirefox = typeof browser !== "undefined";
const api = isFirefox ? browser : chrome;

// null until the user picks a theme manually, then remembered in storage
let savedTheme = null;
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    const label =
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
}

async function initTheme() {
  try {
    const res = await api.storage.local.get("theme");
    savedTheme = res?.theme === "dark" || res?.theme === "light" ? res.theme : null;
  } catch (error) {
    console.error(error);
  }
  // with no stored choice, follow the system theme
  applyTheme(savedTheme || (systemPrefersDark.matches ? "dark" : "light"));
}

// keep following the system theme while the user hasn't picked one
systemPrefersDark.addEventListener("change", (e) => {
  if (!savedTheme) {
    applyTheme(e.matches ? "dark" : "light");
  }
});

document.getElementById("theme-toggle").addEventListener("click", () => {
  savedTheme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";
  applyTheme(savedTheme);
  api.storage.local.set({ theme: savedTheme }).catch(console.error);
});

initTheme();

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
    api.tabs
      .create({ url: api.runtime.getURL("popup.html?standalone=1") })
      .then(() => window.close())
      .catch((error) => {
        console.error(error);
        alert("Could not open the extension tab!");
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

document.getElementById("btn-upload-fallback").onclick = showFallbackCkzInput;

function handleEncPasswdSubmit(e) {
  e.preventDefault();

  const pass = getEncPasswd();

  api.cookies.getAll({}, (cookies) => {
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
      alert("No cookies to backup!");
    }
  });
}

let cookieFile;

function handleFileSelect(e) {
  cookieFile = e.target.files[0];
  if (!cookieFile || !cookieFile.name.endsWith(".ckz")) {
    alert("Not a .ckz file. Please select again!");
    hideDecPasswordInputBox()
    return;
  }
  hideFallbackCkzButton()
  showDecPasswordInputBox()
}

function handleDecPasswdSubmit(e) {
  e.preventDefault();

  const pass = getDecPasswd()

  getCkzFileDataAsText(async (data) => {
    let cookies;

    try {
      const decrypted = sjcl.decrypt(pass, data)
      cookies = JSON.parse(decrypted);
    } catch (error) {
      console.log(error);
      if (error instanceof sjcl.exception.corrupt) {
        alert("Password incorrect!");
      } else if (error instanceof sjcl.exception.invalid) {
        alert("File is not a valid .ckz file!");
      } else {
        alert("Unknown error!");
      }
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
      let url =
        "http" +
        (cookie.secure ? "s" : "") +
        "://" +
        (cookie.domain.startsWith(".")
          ? cookie.domain.slice(1)
          : cookie.domain) +
        cookie.path;

      // Firefox writes "expirationDate: null" for session cookies, so guard before comparing
      if (cookie.expirationDate && epoch > cookie.expirationDate) {
        expirationWarning(cookie.name, url)
        continue;
      }

      if (cookie.hostOnly == true) {
        // https://developer.chrome.com/extensions/cookies#method-set
        // if the cookie is hostOnly, we don't
        // supply the domain because that sets hostOnly to true
        delete cookie.domain;
      }
      // if session is true (or a Firefox-made backup has expirationDate: null),
      // then expirationDate needs to be omitted
      if (cookie.session == true || cookie.expirationDate == null) {
        delete cookie.expirationDate;
      }

      // the sameSite enums differ between the two browsers
      if (isFirefox) {
        // Chrome may report "exactSite" or "unspecified", Firefox only accepts these
        if (!["no_restriction", "lax", "strict"].includes(cookie.sameSite)) {
          delete cookie.sameSite;
        }
      } else if (cookie.sameSite === "lax_plus") {
        cookie.sameSite = "lax";
      } else if (cookie.sameSite === "strict_plus") {
        cookie.sameSite = "strict";
      }

      // .set doesn't accepts these
      delete cookie.hostOnly;
      delete cookie.session;
      delete cookie.storeId;

      // .set wants url
      cookie.url = url;
      let c = null;
      try {
        // resolves to the cookie in Chrome (MV3 promises) and Firefox (browser.* promises)
        c = await api.cookies.set(cookie);
      } catch (error) {
        console.error(error);
      }

      if (c == null) {
        console.error(
          "Error while restoring the cookie for the URL " + cookie.url
        );
        console.error(JSON.stringify(cookie));
        console.error(JSON.stringify(api.runtime.lastError));
        unknownErrWarning(cookie.name, cookie.url)
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
    addToWarningMessageList(createWarning(`Cookie ${cookie_name} for the domain ${cookie_url} could not be restored`))
  }
}

function expirationWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(createWarning(`Cookie ${cookie_name} for the domain ${cookie_url} has expired`))
  }
}

function backupSuccessAlert(totalCookies) {
  addToSuccessMessageList(createSuccessAlert(`Successfully backed up <b>${totalCookies.toLocaleString()}</b> cookies!`))
}

function restoreSuccessAlert(restoredCookies, totalCookies) {
  addToSuccessMessageList(createSuccessAlert(`Successfully restored <b>${restoredCookies.toLocaleString()}</b> cookies out of <b>${totalCookies.toLocaleString()}</b>`));
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
  return document.getElementById("inp-enc-passwd").value.trim();
}

function getDecPasswd() {
  return document.getElementById("inp-dec-passwd").value.trim();
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
  console.log("downloadJson start", filename);

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
      console.error(error);
      addToWarningMessageList(createWarning(`Download failed: <b>${error?.message || error}</b>`));
      return;
    }
    if (!res || !res.ok) {
      addToWarningMessageList(createWarning(`Download failed: <b>${res?.error || "unknown error"}</b>`));
    }
    return;
  }

  if (!api.downloads || !api.downloads.download) {
    addToWarningMessageList(createWarning("downloads API is not available!"))
    alert("downloads API is not available!");
    return;
  }

  const blob = new Blob([data], { type: "application/ckz" });

  let url;
  try {
    // Chrome blocks blob: downloads started from extension pages
    // ("Failed - Extension"), so use a data: URL there. A data: URL is just a
    // string, it doesn't depend on the popup staying alive.
    url = await readAsDataURL(blob);
    console.log("prepared download url", url.slice(0, 30) + "...");
  } catch (error) {
    console.error(error);
    addToWarningMessageList(createWarning(`Preparing the download failed: <b>${error?.message || error}</b>`))
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
    console.error(error);
    const msg = error?.message || error;
    addToWarningMessageList(createWarning(`Download rejected: <b>${msg}</b>`))
    return;
  }

  if (downloadId == null) {
    const msg = api.runtime?.lastError?.message || "download returned no id";
    console.error(msg);
    addToWarningMessageList(createWarning(`Download failed: <b>${msg}</b>`))
    return;
  }

  console.log("download started, id:", downloadId);

  const listener = (delta) => {
    if (delta?.id != downloadId) {
      return;
    }
    if (delta?.state?.current == "complete") {
      Promise.resolve(api.downloads.show(downloadId)).catch(() => {});
      api.downloads.onChanged.removeListener(listener);
    } else if (delta?.state?.current == "interrupted") {
      const msg = delta?.error?.current || "unknown";
      console.error("download interrupted:", msg);
      addToWarningMessageList(createWarning("Download interrupted: <b>" + msg + "</b>"))
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
    reader.onerror = (e) => {
      console.error(e);
      alert("Unknown error while reading the .ckz file!");
    }
  } else {
    cb(getCkzFileContentsFromTextarea())
  }
}
