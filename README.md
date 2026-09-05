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

> Добавляет поддержку Firefox (MV3) и исправляет проблемы с загрузкой файлов в обоих браузерах.

<p align="center">
    <a href="https://chrome.google.com/webstore/detail/cookie-backup-and-restore/cndobhdcpmpilkebeebeecgminfhkpcj"><img src="badge.png" height="60" alt="Chrome Web Store" style="vertical-align: middle;"></a>&nbsp;&nbsp;
    <a href="https://addons.mozilla.org/en-US/firefox/addon/cookie-backup-and-restore/"><img src="firefox.svg" height="60" alt="Firefox Add-ons" style="vertical-align: middle;"></a>
</p>


---

Хотите сменить компьютер или установить новую ОС, но не хотите заново входить во все учетные записи? Используйте это расширение!

Создает резервные копии файлов cookie Chrome, шифрует их и восстанавливает при необходимости. Просто, безопасно и легко в использовании.

<p align="center">

<img src="demo.gif" width=400px>
</p>

Шифрование выполняется с помощью [sjcl](https://bitwiseshiftleft.github.io/sjcl/)

## Поддержка Firefox

Работает в Firefox с тем же манифестом (MV3). Загрузите временное дополнение:

1. Откройте `about:debugging#/runtime/this-firefox`
2. Нажмите «Загрузить временное дополнение...» и выберите `manifest.json` в этой папке.

Файлы cookie, скопированные из Chrome, можно импортировать в Firefox: нажмите кнопку «Вставить» (fallback), вставьте содержимое файла `.ckz` и введите пароль.

## Сборка

Рабочий процесс GitHub Actions (`.github/workflows/build.yml`) выполняется по push/PR и
производит два артефакта:

- `cookie-backup-chrome-<version>-chromium.zip` — загрузить распакованный через `chrome://extensions`
- `cookie-backup-chrome-<version>-firefox.xpi` — временное дополнение через `about:debugging`, 
или загрузите в AMO для подписи (не в списке) перед постоянной установкой

Пометьте релиз (`v*`), чтобы автоматически прикрепить оба архива к релизу GitHub.

# 📜 Лицензия

Проект распространяется под лицензией GPL-3.0. Полный текст лицензии содержится в файле [`LICENSE`](LICENSE).

---
# 💰 Поддержать автора
+ **SBER**: `2202 2050 1464 4675`