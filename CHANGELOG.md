# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).
Версия в `manifest.json` / `manifest.firefox.json` поднимается в момент релиза;
всё ниже — незарелизнутые изменения после `V4.2`.

## [4.3] — Unreleased

### Added — новое

- Подтверждение пароля шифрования: второе поле при создании бэкапа.
  Кнопка Enter подсвечивается, только когда оба поля совпадают (минимум 8 символов).
- Кнопки показать/скрыть пароль (`👁`/`🙈`) в формах шифрования и расшифровки.
- Drag&drop `.ckz`/`.json` на зону загрузки в блоке Restore + подпись с именем
  выбранного файла. Промахнувшийся дроп мимо зоны больше не уводит popup/вкладку.
- Smoke-тесты `test/smoke.cjs` (18 тестов: SJCL-совместимость, оба download-пути,
  валидация (включая allowlist расширений), полнота локалей, паритет версий
  манифестов, статичные стражи) + шаг `Smoke tests` в CI (`.github/workflows/build.yml`).
- Поддержка Firefox MV3: `manifest.firefox.json`, полный UI во вкладке
  (`popup.html?standalone=1`), CI-проверка «манифесты различаются только в `background`».
- В манифестах: `action.default_icon`, `minimum_chrome_version: 88`.
- Новые ключи локалей: `dropHint`, `passwordMismatch`, `passwordTooShort`,
  `fileTooLarge`, `showPassword`/`hidePassword`, `restoreSuccessSkipped`,
  `restoreSuccessFailed`, `emptyBackup`, `dismissLabel`, `backBtn` — все 25 языков полные.
- Кнопки «Назад» (`←`/`→` в RTL) в формах шифрования и расшифровки:
  возврат из под-экранов бэкапа, выбора `.ckz` и paste-режима без перезагрузки.

### Security — безопасность (совместимо с оригинальным расширением)

- PBKDF2-итерации SJCL для **новых** бэкапов: `10000` → `100000`.
  Параметр хранится внутри `.ckz`, поэтому старые бэкапы читаются новым кодом,
  а новые — оригинальным расширением.
- Политика паролей ужесточена только на запись: минимум 8 символов и совпадение
  повтора. Расшифровка старых коротких паролей (от 3 символов) не тронута.
- Пароли затираются из DOM после операций (бэкап — всегда, restore — после успеха).
- Предвалидация `.ckz` до дорогого PBKDF2 (структура `iv`/`ct`, лимит 32 МБ,
  синхронизирован с фоном; запас на ~33% base64-инфляцию `data:` URL).
- Валидация в `background.js`: тип/размер payload (лимит 32 МБ), имя файла
  обрезается до basename (защита от path traversal) и проверяется по allowlist
  (только `.ckz`/`.json`).

### Changed — изменено

- Скачивание — единый путь через `background.js` по сообщению
  `{type: "downloadBackup"}` (убрано ~80 строк дубля в `popup.js`).
  Таймаут запроса поднят до 120 с, т.к. в это время открыт диалог `saveAs`.
- Restore: параллелизм 6 воркеров (`RESTORE_CONCURRENCY`), цепочка fallback-попыток
  одной куки осталась последовательной. Прогресс считается по обработанным,
  а не по успешным.
- Итог restore честный: `restored + skipped + failed = total`, пропуски
  (битые записи, без домена, плохой URL, истекшие) видны в сообщении.
- Имя файла бэкапа — ISO-штамп `cookies-YYYY-MM-DD-HH-mm-ss` (сортируется,
  однозначно в любой локали).
- Ошибки `.json`-restore и чтения файла — инлайн-варнинги вместо `alert()`.
  Итог «0 из N» показывается warning-стилем, а не зелёным success.
- Чистка нейминга: `hideJsonRestoreBox` → `hideJsonRestoreBanner`,
  `cookie_name`/`cookie_url` → camelCase.

### Fixed — исправлено

- `downloads.onChanged`-слушатель жил в popup и умирал вместе с ним при открытии
  `saveAs`-диалога — `revokeObjectURL` и `downloads.show()` терялись.
  Теперь живут в фоне, который переживает диалог.
- Глобальный `drop → preventDefault` ломал перетаскивание текста в textarea —
  теперь блокируются только дропы с файлами.
- Падение `TypeError` при `cookies.getAll() → null` в пути шифрованного бэкапа.
- `expirationDate` не-число из чужих бэкапов больше не уходит в `cookies.set`.
- Пути с пробелами/юникодом и кривые хосты: `encodeURI` + проверка `new URL()`
  вместо гарантированного `cookieRestoreFail`.
- Cancel в `.json`-подтверждении restore не возвращал ссылку
  «Unable to upload a backup file?» — теперь возвращает (выход из тупика).
- Пароль расшифровки затирался только после успеха — теперь и на всех путях
  ошибок (`wrongPassword`/`invalidFile`/пречек).
- Итог restore не считал упавшие `cookies.set`: добавлен счётчик `failed`
  и ключ `restoreSuccessFailed` (`restored + skipped + failed = total`).
- `alert()` для «нет cookies» заменён инлайн-варнингами (для `openTabFail`
  в Firefox-popup оставлен сознательно: UI сообщений там скрыт).
- Двойной `if` совпадения паролей схлопнут, расставлены `;`, убран лишний
  `role="button"`, стабильный ключ дедупа попыток restore.
- `onChanged`-слушатель больше не течёт при усыплении service worker:
  протухший blob-URL подбирается на следующем скачивании + 5-минутный
  страховочный таймер.
- README: пароль ≥8 символов, ISO-имя файла, `iter: 100000`.
- `.json`-restore тоже проверяет размер до `JSON.parse` (защита от OOM
  на огромных файлах); пустой бэкап (`[]`) — отдельный ключ `emptyBackup`.
- Restore переносит контейнеры Firefox (`firstPartyDomain`) и partitioned
  CHIPS (`partitionKey`, с fallback без него); `__Host-`/`__Secure-`-коэрсия
  больше не теряет store/partition/container.
- Пути с `#`/`?` больше не превращаются во фрагмент/query при сборке `url`.
- Куки больше ~4 КБ скипаются досрочно, а не жгут все попытки `cookies.set`.
- После успешного restore UI схлопывается обратно к выбору файла (повторный
  Enter не пере-заливает тот же бэкап); `nb`/`nn` маппятся на `no`.
- Лимиты меряются в байтах (`utf8ByteLength`), а не в UTF-16-юнитах.
- `downloads.download` в фоне работает и на старых Chromium (callback-форма),
  плюс проверка `typeof id === "number"`.
- Длинные списки предупреждений скроллятся внутри popup (`max-height` у
  контейнера; в standalone-вкладке без капа).
- Языковое меню — с клавиатуры (стрелки/Home/End/Enter/Esc), у полей пароля
  и textarea появились `aria-label`.
- Консоль больше не заваливается тысячами строк: первые 20 ошибок подробно,
  дальше — одна итоговая.
- CI: тег релиза сверяется с версией манифеста.
- Кнопки вылезали за пределы popup на языках с длинными переводами
  (de, fr, ru, uk, es, pt, sk, hi и др.): у `.btn-primary`/`.btn-secondary`/
  `.btn-danger` снят `white-space: nowrap` — текст переносится, а ряд кнопок
  в `.insecure-box` умеет переходить на вторую строку (`flex-wrap: wrap`).

### Removed — удалено

- Мёртвые ключи локалей `notCkz`, `noDownloadsApi`, `downloadInterrupted`,
  `prepareFailed` (4 × 25 языков, ~100 строк).
- Мёртвый legacy-алиас `getCkzFileDataAsText`.
