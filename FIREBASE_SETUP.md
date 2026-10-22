# Financia — Firebase setup

The Google sign-in / Firestore integration is prepared in `index.html`, but it will not work until you configure your Firebase project and publish these rules. Do not claim cloud sync is live before completing and testing these steps.

## 1. Enable Google Authentication
1. Firebase Console → Build → Authentication → Get started.
2. Sign-in method → Google → Enable.
3. Select a support email and save.
4. Authentication → Settings → Authorized domains: add the exact production host, `financia.sa-estradaurrego.workers.dev`. Add any custom domain separately if used.

## 2. Create Firestore
1. Firebase Console → Build → Firestore Database → Create database.
2. Choose Standard edition and a location carefully (it cannot easily be changed later).
3. Create the database in production mode.

## 3. Publish the security rules
Open Firestore → Rules and replace the rules with the contents of `firestore.rules`, then Publish.
The app uses `users/{Firebase UID}/finance/main`. The rules only allow an authenticated user to read/write documents beneath their own UID.

## 4. Register the web app and add config
1. Project settings (gear) → General → Your apps → Web app (</>) → register `Financia Web`.
2. Copy the Firebase web config values.
3. In `index.html`, find `window.FINANCIA_FIREBASE_CONFIG` near the Firebase SDK scripts and replace the placeholder values for `apiKey`, `authDomain`, `projectId`, `appId`, and `messagingSenderId` with the values from your Firebase console.
4. The Firebase web config is designed to be present in browser code. Never place service-account private keys or Admin SDK credentials in this file.

## 5. Deploy and test
Deploy the updated `index.html` to the Cloudflare Worker only after the Firebase config and rules are set.
Test with Google sign-in, add a test movement, refresh, and verify the movement remains. Then test a different Google account and verify it cannot see the first account's data.

## Existing local data
The integration deliberately namespaces browser storage by Firebase UID and does not automatically import the old shared `financia.v1` localStorage record, because automatically copying it could expose one person's financial data to another account. A deliberate, user-confirmed migration flow should be added before importing old data.

## Current status
Code changes are prepared on branch `google-login-cloud-save`. Firebase resources, config insertion, Cloudflare deployment, and live tests still require completion.
