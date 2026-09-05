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

> Это форк [candh/cookies-backup-chrome](https://github.com/candh/cookies-backup-chrome),
> поддерживается [AvenCores](https://github.com/AvenCores) по адресу
> [AvenCores/cookies-backup-chrome](https://github.com/AvenCores/cookies-backup-chrome).

> Форк добавляет поддержку Firefox (MV3), 25 языков, тёмную тему,
> backup/restore без пароля (`.json`), fallback-восстановление вставкой текста
> и исправляет проблемы скачивания файлов в обоих браузерах.

<p align="center">
    <a href="https://chrome.google.com/webstore/detail/cookie-backup-and-restore/cndobhdcpmpilkebeebeecgminfhkpcj"><img src="badge.png" height="60" alt="Chrome Web Store" style="vertical-align: middle;"></a>&nbsp;&nbsp;
    <a href="https://addons.mozilla.org/en-US/firefox/addon/cookie-backup-and-restore/"><img src="firefox.svg" height="60" alt="Firefox Add-ons" style="vertical-align: middle;"></a>
</p>

---

Хотите сменить компьютер или установить новую ОС, но не хотите заново входить во все учетные записи? Используйте это расширение!

Создает резервные копии файлов cookie, шифрует их и восстанавливает при необходимости. Просто, безопасно и легко в использовании.

<p align="center">

<img src="demo.gif" width=400px>
</p>

## ✨ Возможности

- **Шифрованный бэкап (`.ckz`)** — все cookies через `cookies.getAll({})` → JSON → [SJCL](https://bitwiseshiftleft.github.io/sjcl/) (`sjcl.encrypt(pass, ...)`, `ks: 256`), пароль минимум 3 символа. Имя файла: `cookies-ДД-ММ-ГГГГ-ЧЧ-ММ-СС.ckz`.
- **Бэкап без пароля (`.json`)** — читаемый plain-JSON с отдельным экраном-предупреждением (`.json` хранит cookies открытым текстом, для переноса/отладки).
- **Восстановление `.ckz` и `.json`** — автовыбор по расширению файла, прогресс-бар (`<progress>`), счётчики `восстановлено X из Y`, предупреждения по каждой проблемной cookie (истекшие / не восстановились) с закрываемыми алертами и дедупликацией.
- **Кросс-браузерное восстановление** — пересборка `url` из `domain + path + secure`, маппинг `sameSite` (`lax_plus`/`strict_plus` → `lax`/`strict`, в Firefox только `no_restriction/lax/strict`), пропуск `hostOnly/session/expirationDate/storeId`-нюансов, защита от `expirationDate: null` у сессионных cookie Firefox.
- **Fallback «Вставить текстом»** — ссылка «Unable to upload a backup file?» скрывает file-input и показывает `textarea` для вставки содержимого `.ckz`/`.json` вручную (нужно для Firefox и для переноса Chrome → Firefox).
- **25 языков + режим Auto** — `locales.js` (`AVAILABLE_LOCALES` + `TRANSLATIONS`), автоопределение по `i18n.getUILanguage()` + `navigator.languages`, кастомное меню с флагами, сохранение выбора в `storage.local.locale`, поддержка RTL (`ar`).
- **Тёмная/светлая тема** — `data-theme` + CSS-переменные, по умолчанию следует `prefers-color-scheme`, ручной выбор запоминается в `storage.local.theme`.
- **Надёжное скачивание в обоих браузерах:**
  - Chrome блокирует `blob:`-загрузки со страниц расширения → используется `data:` URL (`FileReader.readAsDataURL`).
  - Firefox отзывает `blob:` URL вместе с закрывшимся popup (диалог «Save File» убивает popup) → скачивание делегировано в `background.js` (service worker + `scripts` для совместимости), blob живёт в фоне; плюс retry `runtime.sendMessage` на случай спящего MV3-воркера.

## 🧩 Структура проекта

| Файл | Назначение |
|---|---|
| `manifest.json` | MV3-манифест (v4.2): `cookies`, `downloads`, `storage`, `host_permissions: <all_urls>`, `action.default_popup = popup.html`, `background.service_worker/scripts = background.js`, `browser_specific_settings.gecko` (id, `strict_min_version: 109.0`). |
| `popup.html` | UI: шапка (выбор языка, тема), блок бэкапа, блок восстановления, прогресс, сообщения, `open-tab-wrap` для Firefox. Подключает `sjcl.js` → `locales.js` → `popup.js`. |
| `popup.js` | Вся логика: i18n, тема, бэкап `.ckz`/`.json`, восстановление, прогресс, алерты, скачивание, fallback-вставка, Firefox standalone-режим (`?standalone=1`). |
| `background.js` | Фоновое скачивание для Firefox: принимает `{type: "downloadBackup", data, filename}`, создаёт `Blob`, качает через `downloads.download({saveAs: true, conflictAction: "uniquify"})`, чистит `ObjectURL` по `onChanged`. |
| `locales.js` | 25 локалей: `en, ru, uk, de, fr, es, pt, it, pl, nl, sv, da, fi, no, cs, sk, hu, ro, tr, zh-CN, zh-TW, ja, ko, ar, hi`. |
| `style.css` | Светлая/тёмная темы, карточки, кнопки, `insecure-box`, языковое меню, standalone-режим (центровка, `width: 340px`). |
| `sjcl.js` | Stanford Javascript Crypto Library для шифрования. |
| `icons/`, `badge.png`, `firefox.svg`, `demo.gif` | Иконки, бейджи сторов, демо. |
| `.github/workflows/build.yml` | CI: проверка синтаксиса, сборка `.zip`/`.xpi`, публикация в Release. |

## 🔑 Разрешения (почему они нужны)

| Разрешение | Зачем |
|---|---|
| `cookies` | Чтение всех cookies (`getAll`) и запись при восстановлении (`set`). |
| `downloads` | Сохранение `.ckz`/`.json` через диалог `saveAs`. |
| `storage` | Хранение `locale` и `theme`. |
| `host_permissions: <all_urls>` | Восстановление требует reconstruировать `url` для каждого домена (`cookies.set({url, ...})`). |

## 🚀 Установка

### Из магазинов

- Chrome / Chromium: [Chrome Web Store](https://chrome.google.com/webstore/detail/cookie-backup-and-restore/cndobhdcpmpilkebeebeecgminfhkpcj)
- Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cookie-backup-and-restore/)

### Вручную (Chromium)

1. Распакуйте `cookie-backup-chrome-<version>-chromium.zip` из [Releases](https://github.com/AvenCores/cookies-backup-chrome/releases) (или склонируйте репозиторий).
2. Откройте `chrome://extensions`, включите «Режим разработчика».
3. «Загрузить распакованное расширение» → выберите папку проекта.

### Вручную (Firefox)

Работает на том же MV3-манифесте. Нюанс: в popup Firefox нельзя держать открытым нативный file-picker (popup выгружается при потере фокуса, bug 1292701), поэтому popup показывает только кнопку **Open Extension**, которая открывает тот же UI во вкладке `popup.html?standalone=1`, где выбор файла и вставка текста работают штатно.

1. Откройте `about:debugging#/runtime/this-firefox`.
2. «Загрузить временное дополнение...» → выберите `manifest.json` (или готовый `.xpi`).
3. Для постоянной установки `.xpi` нужно подписать его в AMO (канал unlisted), временное дополнение слетает после перезапуска.

## 📖 Использование

**Бэкап с паролем (рекомендуется):**

1. Нажмите **Backup all cookies** → введите пароль шифрования (≥3 символов) → Enter.
2. Выберите место сохранения в диалоге (`cookies-ДД-ММ-ГГГГ-ЧЧ-ММ-СС.ckz`).

**Бэкап без пароля:**

1. Нажмите **Backup without password (.json)** → прочитайте красное предупреждение → **Export .json anyway**.

**Восстановление из файла:**

1. В блоке **Restore Cookies** выберите `.ckz` → введите пароль расшифровки, либо выберите `.json` → подтвердите **Restore .json anyway**.
2. Следите за прогресс-баром и итогом `Successfully restored X out of Y`. Просроченные cookies пропускаются с предупреждением, невосстановившиеся — с указанием `имя + URL`.

**Восстановление вставкой текста (fallback / Chrome → Firefox):**

1. Нажмите «Unable to upload a backup file?».
2. Вставьте содержимое `.ckz`/`.json` в textarea, введите пароль (для `.ckz`) и подтвердите.

## ⚠️ Безопасность

- Шифрование выполняется локально через [SJCL](https://bitwiseshiftleft.github.io/sjcl/) (AES-256). Пароль никуда не отправляется — но если вы его забудете, расшифровать `.ckz` будет невозможно.
- `.json`-бэкап — **открытый текст без шифрования**: любой владелец файла может украсть ваши сессии. Храните его только в надёжном месте, не пересылайте в мессенджерах/почте.
- Рендер сообщений безопасен: переводы используют только маркеры `<b>`, подстановка имён cookie/URL/ошибок идёт через `textContent`/`createElement`, без `innerHTML`.

## 🦊 Совместимость

- Chromium (Chrome/Edge/Opera и др.): полный popup-режим.
- Firefox ≥ 109 (MV3): полный UI во вкладке (`?standalone=1`), скачивание через background worker.
- Перенос Chrome ↔ Firefox поддерживается; различия `sameSite`/`storeId`/сессионных cookie нормализуются автоматически.

## 🔧 Сборка

Рабочий процесс GitHub Actions (`.github/workflows/build.yml`) запускается по push/PR в `main`/`master`, по тегам `v*` и вручную:

1. `node --check` для `popup.js` / `background.js` / `locales.js` + валидация `manifest.json`.
2. Версия читается из `manifest.json` (`VERSION`).
3. Файлы расширения (`manifest.json`, `popup.html`, `popup.js`, `background.js`, `style.css`, `sjcl.js`, `locales.js`, `icons/`) копируются в `build/chromium` и `build/firefox`.
4. Firefox-сборка прогоняется через `addons-linter` (`continue-on-error`).
5. Пакуются артефакты:
   - `cookie-backup-chrome-<version>-chromium.zip` — загрузка распакованным через `chrome://extensions`
   - `cookie-backup-chrome-<version>-firefox.xpi` — временное дополнение через `about:debugging` или загрузка в AMO для подписи (unlisted)
6. По тегу `v*` оба архива автоматически прикрепляются к GitHub Release (`softprops/action-gh-release`).

# 📜 Лицензия

Проект распространяется под лицензией GPL-3.0. Полный текст лицензии содержится в файле [`LICENSE`](LICENSE).

---
# 💰 Поддержать автора
+ **SBER**: `2202 2050 1464 4675`