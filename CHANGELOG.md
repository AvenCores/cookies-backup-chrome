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
- Smoke-тесты `test/smoke.cjs` (14 тестов: SJCL-совместимость, оба download-пути,
  валидация, статичные стражи) + шаг `Smoke tests` в CI (`.github/workflows/build.yml`).
- Поддержка Firefox MV3: `manifest.firefox.json`, полный UI во вкладке
  (`popup.html?standalone=1`), CI-проверка «манифесты различаются только в `background`».
- В манифестах: `action.default_icon`, `minimum_chrome_version: 88`.
- Новые ключи локалей: `dropHint`, `passwordMismatch`, `passwordTooShort`,
  `fileTooLarge`, `showPassword`/`hidePassword`, `restoreSuccessSkipped`, `dismissLabel`.

### Security — безопасность (совместимо с оригинальным расширением)

- PBKDF2-итерации SJCL для **новых** бэкапов: `10000` → `100000`.
  Параметр хранится внутри `.ckz`, поэтому старые бэкапы читаются новым кодом,
  а новые — оригинальным расширением.
- Политика паролей ужесточена только на запись: минимум 8 символов и совпадение
  повтора. Расшифровка старых коротких паролей (от 3 символов) не тронута.
- Пароли затираются из DOM после операций (бэкап — всегда, restore — после успеха).
- Предвалидация `.ckz` до дорогого PBKDF2 (структура `iv`/`ct`, лимит 100 МБ).
- Валидация в `background.js`: тип/размер payload (лимит 64 МБ), имя файла
  обрезается до basename (защита от path traversal).

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

### Removed — удалено

- Мёртвые ключи локалей `notCkz`, `noDownloadsApi`, `downloadInterrupted`,
  `prepareFailed` (4 × 25 языков, ~100 строк).
- Мёртвый legacy-алиас `getCkzFileDataAsText`.
