// Downloads are performed here instead of in popup.js: Firefox revokes every
// blob: URL together with the document that created it, and the popup dies on
// its first focus loss (the "Save File" dialog, opening the downloads panel,
// clicking away), so a blob created in the popup is already revoked by the
// time the downloader reads it. The background context outlives the popup.
const isFirefox = typeof browser !== "undefined";
const api = isFirefox ? browser : chrome;

console.log("[bg] background loaded, isFirefox =", isFirefox);

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[bg] got message:", message?.type);
  if (!message || message.type !== "downloadBackup") {
    return;
  }

  downloadBackup(message.data, message.filename)
    .then((id) => sendResponse({ ok: true, id: id }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

  return true; // keep the channel open, the response is async
});

async function downloadBackup(data, filename) {
  // the blob belongs to this context, so its URL stays valid even after the
  // popup has been closed
  const blob = new Blob([data], { type: "application/ckz" });
  const url = URL.createObjectURL(blob);

  let id;
  try {
    id = await api.downloads.download({
      url: url,
      filename: filename,
      conflictAction: "uniquify",
      // safe here: the blob lives in this context, so the save dialog
      // closing the popup can no longer revoke its URL
      saveAs: true
    });
    console.log("[bg] download started, id:", id);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }

  const listener = (delta) => {
    if (delta?.id != id) return;
    if (delta?.state?.current == "complete") {
      api.downloads.onChanged.removeListener(listener);
      URL.revokeObjectURL(url);
      Promise.resolve(api.downloads.show(id)).catch(() => {});
    } else if (delta?.state?.current == "interrupted") {
      api.downloads.onChanged.removeListener(listener);
      URL.revokeObjectURL(url);
      console.error("download interrupted:", delta?.error?.current);
    }
  };
  api.downloads.onChanged.addListener(listener);

  return id;
}
