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

- **Шифрованный бэкап (`.ckz`)** — все cookies через `cookies.getAll({})` → JSON → [SJCL](https://bitwiseshiftleft.github.io/sjcl/) (`sjcl.encrypt(pass, ...)`, `ks: 256, iter: 100000`), пароль минимум 8 символов. Имя файла: `cookies-ГГГГ-ММ-ДД-ЧЧ-мм-сс.ckz`.
- **Бэкап без пароля (`.json`)** — читаемый plain-JSON с отдельным экраном-предупреждением (`.json` хранит cookies открытым текстом, для переноса/отладки).
- **Восстановление `.ckz` и `.json`** — автовыбор по расширению файла, прогресс-бар (`<progress>`), счётчики `восстановлено X из Y`, предупреждения по каждой проблемной cookie (истекшие / не восстановились) с закрываемыми алертами и дедупликацией.
- **Кросс-браузерное восстановление** — пересборка `url` из `domain + path + secure` (`#`/`?` в пути экранируются, юникод через `encodeURI`), маппинг `sameSite` (`lax_plus`/`strict_plus` → `lax`/`strict`, в Firefox только `no_restriction/lax/strict`), защита от `expirationDate: null` у сессионных cookie Firefox, пре-скип кук больше ~4 КБ, плюс цепочка fallback-попыток на каждую cookie: чужой `storeId` → без него, `SameSite=None` без `Secure` → без `sameSite`, неизвестный `partitionKey` → без него, `__Host-`/`__Secure-` → принудительно `secure` + `https`. Контейнеры Firefox (`firstPartyDomain`) и partitioned-CHIPS (`partitionKey`) переносятся.
- **Fallback «Вставить текстом»** — ссылка «Unable to upload a backup file?» скрывает file-input и показывает `textarea` для вставки содержимого `.ckz`/`.json` вручную (нужно для Firefox и для переноса Chrome → Firefox).
- **25 языков + режим Auto** — `locales.js` (`AVAILABLE_LOCALES` + `TRANSLATIONS`), автоопределение по `i18n.getUILanguage()` + `navigator.languages`, кастомное меню с флагами, сохранение выбора в `storage.local.locale`, поддержка RTL (`ar`).
- **Тёмная/светлая тема** — `data-theme` + CSS-переменные, по умолчанию следует `prefers-color-scheme`, ручной выбор запоминается в `storage.local.theme`.
- **Надёжное скачивание в обоих браузерах:** единый путь через `background.js` — popup шлёт `{type: "downloadBackup", data, filename}` сообщением и только показывает результат. Фон переживает закрытие popup диалогом `saveAs` и сам чистит URL по `downloads.onChanged`:
  - Chrome блокирует `blob:`-загрузки со страниц расширения → в service worker используется `data:` URL, собранный вручную (`TextEncoder` + `btoa`, т.к. там нет `URL.createObjectURL`/`FileReader`).
  - Firefox (event page с DOM) → обычный blob-URL; полный UI при этом работает во вкладке (`?standalone=1`).

## 🧩 Структура проекта

| Файл | Назначение |
|---|---|
| `manifest.json` / `manifest.firefox.json` | MV3-манифесты (v4.2.1): `cookies`, `downloads`, `storage`, `host_permissions: <all_urls>`, `action.default_popup = popup.html`, `browser_specific_settings.gecko` (id, `strict_min_version: 140.0`, `data_collection_permissions: {required: ["none"]}`) + `gecko_android.strict_min_version: 142.0`. Два файла отличаются **только** секцией `background`: Chrome требует `service_worker`, Firefox — `scripts` (один файл на оба браузера невозможен: Chromium отвергает `scripts` в MV3, Firefox игнорирует `service_worker`). CI проверяет, что файлы идентичны кроме `background`. |
| `popup.html` | UI: шапка (выбор языка, тема), блок бэкапа, блок восстановления, прогресс, сообщения, `open-tab-wrap` для Firefox. Подключает `sjcl.js` → `locales.js` → `popup.js`. |
| `popup.js` | Вся логика: i18n, тема, бэкап `.ckz`/`.json`, восстановление, прогресс, алерты, скачивание, fallback-вставка, Firefox standalone-режим (`?standalone=1`). |
| `background.js` | Единственный путь скачивания: сообщение `{type: "downloadBackup", data, filename}` с валидацией (тип/размер payload, имя файла без путей) → blob-URL там, где доступен DOM (Firefox event page), иначе `data:`-URL вручную (`TextEncoder` + `btoa`). Чистит URL по `downloads.onChanged`, показывает файл по `downloads.show`. |
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

### Из магазинов (рекомендуется — подписанные сборки, автообновления)

- Chrome / Chromium: [Chrome Web Store](https://chrome.google.com/webstore/detail/cookie-backup-and-restore/cndobhdcpmpilkebeebeecgminfhkpcj)
- Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cookie-backup-and-restore/)

### Из файла в Releases — Chromium / Chrome / Edge / Opera / Brave

В [Releases](https://github.com/AvenCores/cookies-backup-chrome/releases) скачайте файл `cookie-backup-chrome-<version>-chromium.zip`.

Chrome и Chromium не умеют ставить `.zip` напрямую как подписанный пакет, установка — только как «распакованное расширение»:

1. Распакуйте `.zip` в постоянную папку (не удаляйте её после установки — расширение работает из этой папки).
2. Откройте `chrome://extensions` (в Edge — `edge://extensions`, в Opera — `opera://extensions`), включите «Режим разработчика».
3. «Загрузить распакованное расширение» → выберите распакованную папку.
4. Для обновления: скачайте новый `.zip` из Releases, распакуйте поверх старой папки и нажмите «Обновить» на странице расширений.

Альтернатива — склонировать репозиторий и загрузить его папку таким же способом.

### Из файла в Releases — Firefox (⚠️ файл без подписи)

В [Releases](https://github.com/AvenCores/cookies-backup-chrome/releases) лежит файл `cookie-backup-chrome-<version>-firefox.xpi`.

> ⚠️ Важно: этот `.xpi` **не подписан Mozilla (AMO)**. Обычный Firefox Release/Stable принимает к постоянной установке **только подписанные** `.xpi`. При попытке открыть файл двойным кликом Firefox выдаст ошибку вида «дополнение не может быть установлено, так как не прошло проверку / файл повреждён». Это ограничение Firefox, а не баг расширения. Для постоянной работы без лишних шагов ставьте версию из [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/cookie-backup-and-restore/) — она подписана.
>
> Где ставится неподписанный `.xpi` из Releases:
> - ✅ Firefox Nightly / Developer Edition с отключённой проверкой подписи — постоянно;
> - ✅ Любой Firefox (включая Release) — временно, до перезапуска, через `about:debugging`;
> - ❌ Firefox Release/Stable — постоянно поставить нельзя, только подписать самому через AMO (см. ниже).

**Вариант А. Временно, в любом Firefox (слетает после перезапуска, удобно для проверки):**

1. Скачайте `.xpi` из Releases.
2. Откройте `about:debugging#/runtime/this-firefox`.
3. «Загрузить временное дополнение...» → выберите скачанный `.xpi` (если Firefox просит `manifest.json` — распакуйте `.xpi` как обычный zip и выберите из него `manifest.json`).
4. Расширение будет работать до закрытия браузера.

Нюанс popup в Firefox: в popup нельзя держать открытым нативный file-picker (popup выгружается при потере фокуса, bug 1292701), поэтому popup показывает только кнопку **Open Extension**, которая открывает тот же UI во вкладке `popup.html?standalone=1`, где выбор файла и вставка текста работают штатно.

**Вариант Б. Постоянно в Nightly / Developer Edition:**

1. Откройте `about:config`, поставьте `xpinstall.signatures.required = false`.
2. Откройте скачанный `.xpi` через `Ctrl+O` (или перетащите файл в окно Firefox) → «Установить».
3. Расширение останется после перезапуска.

**Вариант В. Подписать самому для постоянного использования в Release (канал unlisted в AMO):**

1. Распакуйте `.xpi` (или соберите локально: скопируйте репозиторий и замените `manifest.json` содержимым `manifest.firefox.json`).
2. Загрузите сборку на [addons.mozilla.org → Submit → unlisted](https://addons.mozilla.org/developers/) — Mozilla подпишет файл.
3. Скачайте подписанный `.xpi` из AMO и установите его в свой Firefox навсегда.

## 📖 Использование

**Бэкап с паролем (рекомендуется):**

1. Нажмите **Backup all cookies** → введите пароль шифрования (≥8 символов, с повтором) → Enter.
2. Выберите место сохранения в диалоге (`cookies-ГГГГ-ММ-ДД-ЧЧ-мм-сс.ckz`).

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
- Firefox ≥ 140 (MV3, desktop) / ≥ 142 (Android): полный UI во вкладке (`?standalone=1`), скачивание напрямую из вкладки; устанавливается Firefox-сборка (см. выше).
- Перенос Chrome ↔ Firefox поддерживается; различия `sameSite`/`storeId`/сессионных cookie нормализуются автоматически.

## 🔧 Сборка

Рабочий процесс GitHub Actions (`.github/workflows/build.yml`) запускается по push/PR в `main`/`master`, по тегам `v*` и вручную:

1. `node --check` для `popup.js` / `background.js` / `locales.js` + валидация `manifest.json` и `manifest.firefox.json` (включая проверку, что файлы отличаются только секцией `background`).
2. Версия читается из `manifest.json` (`VERSION`).
3. Файлы расширения (`manifest.json`, `popup.html`, `popup.js`, `background.js`, `style.css`, `sjcl.js`, `locales.js`, `icons/`) копируются в `build/chromium` и `build/firefox`, затем `manifest.firefox.json` кладётся в `build/firefox/manifest.json`.
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