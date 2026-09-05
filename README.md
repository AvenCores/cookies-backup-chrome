<div align="center">
    <a href="https://www.youtube.com/@avencores/" target="_blank">
      <img src="https://github.com/user-attachments/assets/338bcd74-e3c3-4700-87ab-7985058bd17e" alt="YouTube" height="40">
    </a>
    <a href="https://t.me/avencoresyt" target="_blank">
      <img src="https://github.com/user-attachments/assets/939f8beb-a49a-48cf-89b9-d610ee5c4b26" alt="Telegram" height="40">
    </a>
    <a href="https://vk.ru/avencoresreuploads" target="_blank">
      <img src="https://github.com/user-attachments/assets/dc109dda-9045-4a06-95a5-3399f0e21dc4" alt="VK" height="40">
    </a>
    <a href="https://dzen.ru/avencores" target="_blank">
      <img src="https://github.com/user-attachments/assets/bd55f5cf-963c-4eb8-9029-7b80c8c11411" alt="Dzen" height="40">
    </a>
</div>

# cookies-backup-chrome

> This is a fork of [candh/cookies-backup-chrome](https://github.com/candh/cookies-backup-chrome),
> maintained by [AvenCores](https://github.com/AvenCores) at
> [AvenCores/cookies-backup-chrome](https://github.com/AvenCores/cookies-backup-chrome).
> It adds Firefox (MV3) support and fixes file downloads in both browsers.

<p align="center">
    <a href="https://chrome.google.com/webstore/detail/cookie-backup-and-restore/cndobhdcpmpilkebeebeecgminfhkpcj"><img src="badge.png"></a>
</p>

---

Want to change machines or want to do a fresh OS install but don't want to re-sign-in to everything you ever signed in? Use this extension!

Backups Chrome Cookies, Encrypts them and Restores them when needed. Simple, Secure and Easy to Use.

<p align="center">
    <img src="demo.gif" width=400px>
</p>

Encryption is done using [sjcl](https://bitwiseshiftleft.github.io/sjcl/)

## Firefox support

Works on Firefox with the same manifest (MV3). Load it temporarily:

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..." and select `manifest.json` in this folder

Cookies backed up from Chrome can be imported into Firefox: click the fallback
"paste" button, paste the contents of the `.ckz` file, and enter the password.

## Building

The GitHub Actions workflow (`.github/workflows/build.yml`) runs on push/PR and
produces two artifacts:

- `cookie-backup-chrome-<version>-chromium.zip` — load unpacked via `chrome://extensions`
- `cookie-backup-chrome-<version>-firefox.xpi` — temporary add-on via `about:debugging`,
  or upload to AMO for signing (unlisted) before permanent installation

Tag a release (`v*`) to attach both archives to a GitHub Release automatically.

# 📜 Лицензия

Проект распространяется под лицензией GPL-3.0. Полный текст лицензии содержится в файле [`LICENSE`](LICENSE).

---
# 💰 Поддержать автора
+ **SBER**: `2202 2050 1464 4675`