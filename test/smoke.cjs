// Smoke tests for cookies-backup-chrome. Run: node test/smoke.cjs
// Covers: SJCL cross-compat (old iter:10000 <-> new iter:100000),
// locales completeness (every locale carries every en key),
// background.js download message flow (both URL strategies + validation),
// manifest version parity, and static guards against reintroducing
// removed duplication/dead keys.
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.join(__dirname, "..");
let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log("ok - " + name);
}

// ---------- 1. SJCL encrypt/decrypt compatibility ----------
const sjclSrc = fs.readFileSync(path.join(ROOT, "sjcl.js"), "utf8");
const sjclCtx = { console };
vm.createContext(sjclCtx);
vm.runInContext(sjclSrc, sjclCtx);
const compatOut = vm.runInContext(
  `(() => {
    const oldP = sjcl.encrypt("abc", JSON.stringify([{ name: "a", value: "b" }]), { ks: 256 });
    const newP = sjcl.encrypt("strongpass123", JSON.stringify([{ name: "a", value: "b" }]), { ks: 256, iter: 100000 });
    const o1 = JSON.parse(oldP), o2 = JSON.parse(newP);
    const d1 = JSON.parse(sjcl.decrypt("abc", oldP));
    const d2 = JSON.parse(sjcl.decrypt("strongpass123", newP));
    let wrong = "UNEXPECTED_OK";
    try { sjcl.decrypt("wrong", newP); }
    catch (e) { wrong = (e instanceof sjcl.exception.corrupt) ? "corrupt" : "other"; }
    return JSON.stringify({ oldIter: o1.iter, newIter: o2.iter, oldOk: Array.isArray(d1), newOk: Array.isArray(d2), wrong });
  })()`,
  sjclCtx
);

ok("sjcl old/new payloads cross-decrypt", () => {
  const r = JSON.parse(compatOut);
  assert.strictEqual(r.oldIter, 10000);
  assert.strictEqual(r.newIter, 100000);
  assert.strictEqual(r.oldOk, true);
  assert.strictEqual(r.newOk, true);
  assert.strictEqual(r.wrong, "corrupt");
});

// ---------- 1b. locales completeness: every locale must carry every en key ----------
// (const-bindings don't leak to the vm sandbox object, so inspect from inside)
const localesSrc = fs.readFileSync(path.join(ROOT, "locales.js"), "utf8");
const localesCtx = {};
vm.createContext(localesCtx);
vm.runInContext(localesSrc, localesCtx);
const localesMissing = vm.runInContext(
  `(() => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const out = {};
    for (const entry of AVAILABLE_LOCALES) {
      const dict = TRANSLATIONS[entry.code];
      if (!dict) {
        out[entry.code] = ["__MISSING_DICT__"];
        continue;
      }
      const miss = enKeys.filter((k) => !(k in dict));
      if (miss.length) out[entry.code] = miss;
    }
    return JSON.stringify(out);
  })()`,
  localesCtx
);

ok("locales are complete (no missing keys)", () => {
  assert.deepStrictEqual(JSON.parse(localesMissing), {});
});

// ---------- 2. background.js message flow ----------
function makeBgContext({ blobUrls }) {
  let msgListener = null;
  const changed = [];
  const state = { downloads: [], shown: [], revoked: 0 };
  const ctx = {
    console,
    URL: blobUrls
      ? {
          createObjectURL: () => "blob:fake-url",
          revokeObjectURL: () => { state.revoked++; },
        }
      : {},
    TextEncoder,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    Blob: class Blob {
      constructor(parts) { this.parts = parts; }
    },
    chrome: {
      runtime: {
        lastError: null,
        onMessage: { addListener: (fn) => { msgListener = fn; } },
      },
      downloads: {
        download: (opts) => {
          state.downloads.push(opts);
          return Promise.resolve(42);
        },
        show: (id) => { state.shown.push(id); },
        onChanged: {
          addListener: (fn) => changed.push(fn),
          removeListener: (fn) => {
            const i = changed.indexOf(fn);
            if (i >= 0) changed.splice(i, 1);
          },
        },
      },
    },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "background.js"), "utf8"), ctx);
  assert.ok(msgListener, "background must register onMessage listener");
  const send = (msg) =>
    new Promise((resolve) => {
      let done = false;
      const ret = msgListener(msg, {}, (resp) => {
        done = true;
        resolve({ response: resp, keepAlive: ret });
      });
      setTimeout(() => { if (!done) resolve({ response: "NO_RESPONSE", keepAlive: ret }); }, 500);
    });
  const fireChanged = (delta) => changed.slice().forEach((fn) => fn(delta));
  // Firefox-style caller: browser.runtime.sendMessage takes a single argument
  // and the onMessage listener answers via the returned promise (no
  // sendResponse callback). Old code returned `true` and never resolved.
  const sendFirefox = (msg) => Promise.resolve(msgListener(msg, {}));
  return { state, changed, send, sendFirefox, fireChanged };
}

(async () => {
  // service-worker path (no createObjectURL -> data: URL)
  {
    const bg = makeBgContext({ blobUrls: false });
    const { response, keepAlive } = await bg.send({ type: "downloadBackup", data: "hello", filename: "cookies-a.ckz" });
    ok("bg data-url download starts", () => {
      assert.strictEqual(keepAlive, true);
      // response comes from another vm realm: compare structurally
      assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true, id: 42 });
      assert.ok(bg.state.downloads[0].url.startsWith("data:application/octet-stream;base64,"));
      assert.strictEqual(bg.state.downloads[0].saveAs, true);
      assert.strictEqual(bg.state.downloads[0].conflictAction, "uniquify");
    });
    bg.fireChanged({ id: 42, state: { current: "complete" } });
    ok("bg complete shows file and cleans listener", () => {
      assert.deepStrictEqual(bg.state.shown, [42]);
      assert.strictEqual(bg.changed.length, 0);
    });
  }

  // event-page path (blob URL + revoke)
  {
    const bg = makeBgContext({ blobUrls: true });
    const { response } = await bg.send({ type: "downloadBackup", data: "x", filename: "cookies-b.ckz" });
    ok("bg blob download starts", () => {
      assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true, id: 42 });
      assert.strictEqual(bg.state.downloads[0].url, "blob:fake-url");
    });
    bg.fireChanged({ id: 42, state: { current: "complete" } });
    ok("bg blob url revoked", () => {
      assert.strictEqual(bg.state.revoked, 1);
    });
  }

  // validation
  {
    const bg = makeBgContext({ blobUrls: false });
    const bad1 = await bg.send({ type: "downloadBackup", data: "", filename: "x.ckz" });
    ok("bg rejects empty payload", () => {
      assert.strictEqual(bad1.response.ok, false);
    });
    const bad2 = await bg.send({ type: "downloadBackup", data: "abc" });
    ok("bg rejects missing filename", () => {
      assert.strictEqual(bad2.response.ok, false);
    });
    const nBefore = bg.state.downloads.length;
    const trav = await bg.send({ type: "downloadBackup", data: "abc", filename: "..\\..\\evil.ckz" });
    ok("bg strips path traversal", () => {
      assert.strictEqual(trav.response.ok, true);
      assert.strictEqual(bg.state.downloads[nBefore].filename, "evil.ckz");
    });
    const badExt = await bg.send({ type: "downloadBackup", data: "abc", filename: "evil.exe" });
    ok("bg rejects disallowed extension", () => {
      assert.strictEqual(badExt.response.ok, false);
    });
    const other = await bg.send({ type: "other" });
    ok("bg ignores foreign messages", () => {
      assert.strictEqual(other.response, "NO_RESPONSE");
    });
  }

  // Firefox-style messaging: no sendResponse callback, the listener must
  // answer through the returned promise (browser.* is promise-only, and a
  // function 2nd arg to sendMessage is misread as (extensionId, message)).
  {
    const bg = makeBgContext({ blobUrls: true });
    const response = await bg.sendFirefox({ type: "downloadBackup", data: "hello-firefox", filename: "cookies-2026-01-01-00-00-00-audit.csv" });
    ok("bg answers Firefox-style callers via returned promise", () => {
      assert.deepStrictEqual(JSON.parse(JSON.stringify(response)), { ok: true, id: 42 });
      assert.strictEqual(bg.state.downloads[0].filename, "cookies-2026-01-01-00-00-00-audit.csv");
    });
    const foreign = await bg.sendFirefox({ type: "other" });
    ok("bg ignores foreign Firefox-style messages", () => {
      assert.strictEqual(foreign, undefined);
    });
  }

  // ---------- 2c. formats.js round-trips every export format ----------
  // Guards the export side: serializers must produce text that parses back
  // to the same cookies (incl. commas/quotes/unicode in values for CSV).
  {
    const fctx = {};
    vm.createContext(fctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "formats.js"), "utf8"), fctx);
    const res = vm.runInContext(
      `(() => {
        const sample = [
          { name: "sess", value: "a,b\\"c", domain: ".example.com", path: "/", secure: true, httpOnly: true, expirationDate: 2000000000, sameSite: "lax", hostOnly: false, storeId: "0" },
          { name: "uni", value: "привет", domain: "example.com", path: "/", hostOnly: true, session: true },
        ];
        const out = {};
        for (const f of ["json", "netscape", "header", "puppeteer", "pydict", "csv"]) {
          const text = formatSerialize(f, sample);
          const parsed = formatParse(f, text, { fallbackDomain: "example.com" });
          out[f] = { len: text.length, count: parsed.length, names: parsed.map((c) => c.name).join(",") };
        }
        return JSON.stringify(out);
      })()`,
      fctx
    );
    ok("all export formats serialize and parse back", () => {
      const r = JSON.parse(res);
      for (const f of ["json", "netscape", "header", "puppeteer", "pydict", "csv"]) {
        assert.strictEqual(r[f].count, 2, f + " must round-trip 2 cookies");
        assert.strictEqual(r[f].names, "sess,uni", f + " must keep cookie names");
        assert.ok(r[f].len > 0, f + " must produce text");
      }
    });
  }

  // ---------- 2b. popup boots cleanly under a stubbed DOM ----------
  // Regression gate for init-time crashes (e.g. wiring code reading a
  // `let`/`const` declared later in the file — a TDZ ReferenceError aborts
  // the rest of the module init). The whole module must evaluate and settle
  // with every wire step reached.
  {
    const bootEls = {};
    const mkEl = () => {
      const listeners = {};
      return {
        _listeners: listeners,
        style: {}, dataset: {}, textContent: "", title: "", value: "",
        type: "password", files: null, placeholder: "", innerHTML: "",
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; },
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        appendChild() {}, append() {}, replaceChildren() {},
        querySelector() { return null; },
        focus() {}, click() {},
      };
    };
    const listenersOf = (id, type) => ((bootEls[id] && bootEls[id]._listeners[type]) || []).length;
    const pctx = {
      console,
      document: {
        documentElement: { lang: "", dir: "", setAttribute() {}, getAttribute() { return "light"; } },
        getElementById(id) { return (bootEls[id] = bootEls[id] || mkEl()); },
        querySelectorAll() { return []; },
        querySelector() { return null; },
        addEventListener() {},
        createElement() { return mkEl(); },
      },
      window: {},
      navigator: { userAgent: "node-smoke", languages: ["en"], language: "en" },
      location: { search: "" },
      chrome: {
        storage: { local: { get: async () => ({}), set: async () => {} } },
        runtime: { getManifest: () => ({ version: "0.0.0" }), lastError: null },
        i18n: { getUILanguage: () => "en" },
        cookies: {}, tabs: {},
      },
      setTimeout, clearTimeout,
    };
    pctx.window.matchMedia = () => ({ matches: false, addEventListener() {} });
    pctx.window.getSelection = () => null;
    vm.createContext(pctx);
    // must not throw: any read-before-init during wiring fails here
    vm.runInContext(fs.readFileSync(path.join(ROOT, "locales.js"), "utf8"), pctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "popup.js"), "utf8"), pctx);
    await new Promise((r) => setTimeout(r, 150));
    ok("popup boots without exceptions and wires everything", () => {
      assert.strictEqual(bootEls["picked-file-status"].textContent, "No file chosen");
      assert.ok(bootEls["toggle-enc-passwd"].innerHTML.includes("<svg"), "eye icon rendered");
      for (const [id, type] of [
        ["restore", "change"],
        ["dec-passwd-form", "submit"],
        ["enc-passwd-form", "submit"],
        ["btn-about", "click"],
        ["btn-donate", "click"],
        ["toggle-enc-passwd", "click"],
        ["restore-picker-label", "keydown"],
        ["btn-copy-card", "click"],
      ]) {
        assert.ok(listenersOf(id, type) > 0, id + " listens for " + type);
      }
    });
  }

  // ---------- 3. static guards ----------
  const popup = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");
  ok("popup has no download duplication", () => {
    for (const token of ["new Blob", "createObjectURL", "revokeObjectURL", "readAsDataURL", "downloadsDownload", "api.downloads"]) {
      assert.ok(!popup.includes(token), "popup.js must not contain " + token);
    }
  });
  ok("popup restores in parallel with honest counters", () => {
    for (const token of ["RESTORE_CONCURRENCY", "restoreOne", "skipped++", "failed++", "restoreSuccessFailed", "emptyBackup", "firstPartyDomain", "partitionKey", "utf8ByteLength", "updateRestoreProgressBar(processed)"]) {
      assert.ok(popup.includes(token), "popup.js must contain " + token);
    }
  });
  const bgSrc = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
  ok("background downloads old-Chrome compatible", () => {
    for (const token of ["downloadsDownload", "utf8ByteLength", "typeof id !=="]) {
      assert.ok(bgSrc.includes(token), "background.js must contain " + token);
    }
  });
  ok("messaging is Firefox-safe", () => {
    assert.ok(popup.includes("api.runtime.sendMessage({ type"), "popup.js must use single-arg sendMessage on Firefox");
    assert.ok(bgSrc.includes("return promise;"), "background.js must answer via returned promise");
  });
  ok("packaging includes every popup script", () => {
    // regression gate: every local <script src> in popup.html must be staged
    // by build.yml, otherwise the packaged .zip/.xpi breaks at runtime with
    // "Loading failed for the <script>" (formats.js was once forgotten, which
    // broke every non-JSON export while JSON kept working via its fallback)
    const html = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
    const yml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "build.yml"), "utf8");
    const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((s) => !/^https?:/.test(s));
    assert.ok(srcs.length > 0, "popup.html must load local scripts");
    for (const s of srcs) {
      assert.ok(yml.includes(s), "build.yml must package " + s);
    }
  });
  const locales = fs.readFileSync(path.join(ROOT, "locales.js"), "utf8");
  ok("locales have no dead keys", () => {
    for (const key of ["notCkz", "noDownloadsApi", "downloadInterrupted", "prepareFailed"]) {
      assert.ok(!locales.includes('"' + key + '"'), "locales.js must not contain " + key);
    }
    assert.ok(locales.includes('"restoreSuccessSkipped"'));
    assert.ok(locales.includes('"dismissLabel"'));
  });
  for (const f of ["manifest.json", "manifest.firefox.json"]) {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
    ok(f + " declares icon + chrome floor", () => {
      assert.ok(m.action && m.action.default_icon);
      assert.ok(m.minimum_chrome_version);
    });
  }
  ok("manifests share version", () => {
    const a = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.firefox.json"), "utf8"));
    assert.strictEqual(a.version, b.version);
  });

  console.log("\n" + passed + " smoke tests passed");
})().catch((e) => {
  console.error("SMOKE FAILED:", e && e.stack || e);
  process.exitCode = 1;
});
