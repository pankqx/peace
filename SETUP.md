# Turning on online rooms (Firebase, free)

The site works in solo mode without this. Online rooms need a free Firebase Realtime Database. It takes about 5 minutes.

## 1. Create the project
1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `peace-cards` (any name works).
3. Google Analytics is not needed — turn it off and click **Create project**.

## 2. Create the database
1. In the left menu open **Build → Realtime Database** and click **Create Database**.
2. Location: pick **Singapore (asia-southeast1)** — closest to India, so cards deal faster.
3. Choose **Start in locked mode** and click **Enable**.
4. Open the **Rules** tab, delete everything, paste the contents of `database.rules.json` from this repo, and click **Publish**.

## 3. Register the website
1. Click the gear icon next to **Project Overview → Project settings**.
2. Under **Your apps**, click the web icon `</>`.
3. Nickname: `peace-web`. Leave "Firebase Hosting" unticked (we use GitHub Pages). Click **Register app**.
4. You'll see a `firebaseConfig = { ... }` block. Copy it.
   Check it has a `databaseURL` line. If it doesn't, copy the URL shown at the top of the Realtime Database page (it ends in `firebasedatabase.app`) and add it as `databaseURL`.

## 4. Paste the config
Open `js/firebase-config.js` and replace `export const firebaseConfig = null;` with:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://....firebasedatabase.app",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

Commit and push. GitHub Pages updates in a minute or two, and **Create a room** starts working.

> The `apiKey` in a Firebase web config is not a secret — it only identifies your project. Access is controlled by the database rules.

## Free limits
The free Spark plan gives 100 simultaneous connections and 1 GB of storage — plenty for friends' card nights. Old rooms are tiny; you can delete the `rooms` node in the console any time to clean up.
