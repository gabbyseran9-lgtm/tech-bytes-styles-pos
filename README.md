# Tech Bytes Styles POS
Static web app (HTML/CSS/JS, no build step) + Google Apps Script backend + Google Sheets database. No login, by design.

## 1. Create the Google Sheet and backend
1. Create a new Google Sheet. Open **Extensions → Apps Script**.
2. Replace the editor contents with `google-apps-script/Code.gs`. In **Project Settings** set the time zone to **Asia/Manila**.
3. Select `setup` in the function dropdown and click **Run**. Approve the authorization prompt. The 7 sheets and the 4 products (price ₱0, to be set by you) are created.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the `/exec` URL.
5. After any later change to Code.gs: **Deploy → Manage deployments → Edit → New version**.

## 2. Configure the frontend
Paste the `/exec` URL into `config.js`. Open `index.html` through a local server (`python3 -m http.server`) to test.

## 3. Publish to GitHub Pages
`git init && git add . && git commit -m "POS" && git branch -M main && git remote add origin <your repo URL> && git push -u origin main`
Then repo **Settings → Pages → Deploy from branch → main / (root)**. The site appears at `https://<user>.github.io/<repo>/`.

## 4. Security note
"Anyone" access means anyone who has the URL can read and write your data; a hard-to-guess URL is not real security. Keep the URL private, do not post it publicly, and consider adding a shared access key check in Code.gs before wide use.

## 5. Test checklist
Set prices/costs in Products → receive stock → sell 2 items, check change, receipt print, stock deducted → try selling more than stock (blocked) → add a previous sale → cancel a sale (stock restored) → add an expense → run Income statement → export CSVs → refresh and open on another device.

## 6. Troubleshooting
- "Could not reach Google Sheets": URL wrong in `config.js`, deployment access not "Anyone", or you edited Code.gs without deploying a new version.
- "Run setup() first": run `setup` in the bound script.
- Authorization/CORS error in the console: re-deploy as Web app, execute as Me, and use the `/exec` URL (not `/dev`).
- Blank profit figures marked "incomplete": set cost per unit in Products.
