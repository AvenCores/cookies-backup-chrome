# cookies-backup-chrome

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
