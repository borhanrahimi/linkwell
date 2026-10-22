# Saving from anywhere

How to set up each way of saving a link to Linkwell. The landing page explains them for visitors; this page has the details.

Every way of saving opens the same page, `/share?url=...&title=...`. It shows a small card with the link, a title, tags and a folder (with **New folder…**); nothing is saved until you click **Save link** (otherwise any website could add links to your account by opening that address).

| Where | How to set it up |
|---|---|
| Chrome, Edge, Brave, Arc | **Extension:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension/` folder, then pin it. Click the Linkwell button or press Alt+Shift+S on any page. See [extension/README.md](../extension/README.md) |
| Any desktop browser | **Bookmarklet:** drag **Save to Linkwell** from the account page (Save from anywhere) to your bookmarks bar (Cmd+Shift+B shows the bar) |
| Android | Open Linkwell in Chrome, **⋮ → Install app**. Linkwell then appears in every app's Share menu |
| Anywhere (easiest on iPhone) | **Paste button:** copy a link in any app, open Linkwell, tap **Paste** next to the link box, then Save. It only shows in browsers that let pages read the clipboard |
| iPhone | **Shortcut:** in the Shortcuts app, make "Save to Linkwell" with *Show in Share Sheet* on: Receive **URLs and Safari web pages** → **URL Encode** Shortcut Input → **Text** `https://linkwell-dypu.vercel.app/share?url=` + URL Encoded Text → **Open URLs**. For the app itself: Safari → Share → **Add to Home Screen** |

The extension and the bookmarklet made from the live site save to the live site. To try the extension with `npm run dev`, change `LINKWELL` in `extension/background.js` to `http://localhost:3000` (and back before committing).

## Importing bookmarks

On the account page, **Import bookmarks** reads a bookmarks file (Chrome: `chrome://bookmarks` → ⋮ → Export bookmarks; Safari: File → Export → Bookmarks; Firefox: Bookmarks → Manage bookmarks → Import and Backup → Export; Raindrop: Settings → Export → HTML). You see how many links and folders it found before anything is saved. Folders become Linkwell folders (the browser's own "Bookmarks bar" isn't one), tags come along, and links you already have are skipped, so importing the same file twice is safe.
