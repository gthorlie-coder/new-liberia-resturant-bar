# Deploying New Liberia Restaurant & Bar

Getting this live has two parts: the **backend API + database** (fully
deployable today), and the **customer app** (a Flutter **web** build can be
live today too; the native Android/iOS app stores add a review queue of a
few days regardless of who builds it).

Steps that create accounts or enter secrets are yours to do — I can't sign
up for services or hold credentials on your behalf. Everything else
(reading error logs, checking config, adjusting code) I can help with live
as you go.

---

## Part A — Backend API + Database (today)

### 1. Push the code to GitHub
```bash
cd new-liberia
git init
git add .
git commit -m "Initial commit: Phase 1 backend + mobile scaffold"
```
Create an empty repo on github.com (e.g. `new-liberia-restaurant-bar`), then:
```bash
git remote add origin https://github.com/<your-username>/new-liberia-restaurant-bar.git
git branch -M main
git push -u origin main
```

### 2. Create a Firebase project (for Authentication)
1. Go to https://console.firebase.google.com → **Add project**.
2. In **Build → Authentication → Sign-in method**, enable **Phone**,
   **Google**, and **Apple**.
3. Go to **Project settings → Service accounts → Generate new private key**.
   This downloads a JSON file with `project_id`, `client_email`, and
   `private_key` — you'll paste these into Render in step 4.

### 3. Create a Render account and deploy
1. Go to https://render.com → sign up → **New +** → **Blueprint**.
2. Connect your GitHub account and pick the repo you just pushed.
   Render reads `render.yaml` automatically and provisions:
   - the API as a web service (from `backend/Dockerfile`)
   - a managed PostgreSQL database, wired to the API via `DATABASE_URL`
3. When prompted, paste in the three Firebase values from step 2:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   (keep the `\n` characters in the private key literal — the app already
   converts them back to real newlines).

### 4. Run migrations and seed data
Render gives you a **Shell** tab on the web service once it's deployed:
```bash
npm run migrate
npm run seed
```
Then check `https://<your-service>.onrender.com/health` — you should see
`{"status":"ok"}`. That URL is your live `baseUrl` for the app.

---

## Part B — A live, usable app today (Flutter Web)

Native builds (Play Store / App Store) are the right long-term target, but
both require developer accounts (Google: one-time fee; Apple: $99/year)
and review time. To get something people can actually open on a phone
*today*, build the same Flutter app for web:

1. Install Flutter locally (https://docs.flutter.dev/get-started/install)
   if you haven't already.
2. In `mobile/`, point the app at your live backend instead of the local
   emulator address — in `lib/services/api_client.dart` change:
   ```dart
   ApiClient({this.baseUrl = 'https://<your-service>.onrender.com/api/v1'});
   ```
3. Run `flutterfire configure` to generate `firebase_options.dart` for the
   same Firebase project from Part A.
4. Build and deploy:
   ```bash
   flutter build web
   ```
   Then deploy the `build/web` folder to **Firebase Hosting** (free, and
   already tied to the project you made):
   ```bash
   firebase init hosting   # point it at build/web
   firebase deploy
   ```
   You'll get a real `https://<project>.web.app` link, live, shareable on
   any phone or laptop browser today.

---

## Part C — Native app stores (when ready)

1. **Android**: create a Google Play Console account (one-time $25 fee),
   run `flutter build appbundle`, upload it, fill in the store listing.
   Internal testing track can go live within hours; public release after
   Google's review (typically 1–3 days).
2. **iOS**: enroll in the Apple Developer Program ($99/year), run
   `flutter build ipa`, upload via Xcode/Transporter to App Store Connect.
   TestFlight builds are available almost immediately; public App Store
   review usually takes 1–2 days.

---

## Checklist recap

- [ ] Code pushed to GitHub
- [ ] Firebase project created, Auth providers enabled, service account key generated
- [ ] Render account created, blueprint deployed, Firebase secrets pasted in
- [ ] Migrations + seed run in Render Shell, `/health` returns ok
- [ ] Flutter app pointed at the live API URL
- [ ] Flutter web build deployed to Firebase Hosting
- [ ] (When ready) Play Console + App Store Connect accounts for native release

Tell me which step you're on and any error message or screenshot you get —
I'll help you work through it.
