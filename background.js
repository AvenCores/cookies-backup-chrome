// MV3 background context: a service worker in Chromium, an event page in
// Firefox. The same file must run in both, so it can only rely on the worker
// surface: service workers have no URL.createObjectURL and no FileReader.
// Blob downloads are used when available (event page); otherwise the payload
// is encoded as a data: URL by hand, which chrome.downloads accepts.
const isFirefox = typeof browser !== "undefined";
const api = isFirefox ? browser : chrome;

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "downloadBackup") {
    return;
  }

  downloadBackup(message.data, message.filename)
    .then((id) => sendResponse({ ok: true, id: id }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

  return true; // keep the channel open, the response is async
});

// Builds a data: URL from a string without FileReader/URL.createObjectURL,
// which do not exist in service workers. TextEncoder and btoa exist in both
// workers and documents. Chunked conversion avoids blowing the call stack on
// large backups.
function stringToDataUrl(data) {
  const bytes = new TextEncoder().encode(data);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return "data:application/octet-stream;base64," + btoa(binary);
}

async function downloadBackup(data, filename) {
  // Prefer a blob URL where the platform has one; fall back to an inline
  // data: URL in service workers (Chromium accepts it in downloads.download).
  let url = null;
  let isBlobUrl = false;
  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const blob = new Blob([data], { type: "application/octet-stream" });
    url = URL.createObjectURL(blob);
    isBlobUrl = true;
  } else {
    url = stringToDataUrl(data);
  }

  const revoke = () => {
    if (isBlobUrl && url) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
      url = null;
    }
  };

  let id;
  try {
    id = await api.downloads.download({
      url: url,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: true
    });
  } catch (error) {
    revoke();
    throw error;
  }

  const listener = (delta) => {
    if (delta?.id != id) return;
    if (delta?.state?.current == "complete") {
      api.downloads.onChanged.removeListener(listener);
      revoke();
      try {
        const shown = api.downloads.show(id);
        if (shown && typeof shown.catch === "function") shown.catch(() => {});
      } catch (e) {}
    } else if (delta?.state?.current == "interrupted") {
      api.downloads.onChanged.removeListener(listener);
      revoke();
    }
  };
  api.downloads.onChanged.addListener(listener);

  return id;
}
