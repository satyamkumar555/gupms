# Galgotias University Placement Management System (GU-PMS)

Corporate Relations / Placement ERP for Galgotias University. Built from `Flowchart.txt` and `Placement_Portal_Flowchart.pptx`.
**Stack:** TypeScript monorepo · Website = Next.js 14 + Tailwind (static site on **Firebase Hosting**) · API = Node.js + Express (one **Cloud Function** for Firebase) · Data = Firebase Authentication + Cloud Firestore (files in Firestore or Firebase Storage). **Everything runs on Firebase and is deployed with one command: `npm run deploy`.**

Contents: 1 Run it · 2 How everything is connected · 3 Where each thing is stored · 4 Roles and logins · 5 File structure · 6 How it works · 7 Modules and who can use them · 8 API list · 9 Admin daily tasks · 10 Tests · 11 Troubleshooting · 12 Status and what is not done · 13 Deploy to the internet

---
## 1. Run it (Windows PowerShell; Mac/Linux is the same)
**One-time requirements:** Node.js 20+, and your Firebase project with *Authentication > Email/Password* and *Firestore* enabled, plus a service-account key file (already set up in your copy).

```powershell
cd gu-pms
npm run install:all        # installs API + website packages (once)
npm run dev                # starts API (port 4000) + website (port 3000) connected to FIREBASE
```
Open **http://localhost:3000** (student login + registration). Staff use the **Admin Login** link at the bottom of that page (`/staff`).

**First time only**
1. Check the two Firebase env files (already filled in this zip, do not delete them) - see section 2.
2. Create your first Admin (works on your real Firebase project):
   `npm run create-admin:firebase -- you@university.edu YourStrongPassword "Your Name"`
3. Remove old demo accounts/data if the project ever had them (shows a list first, deletes nothing):
   `npm run remove-demo:firebase`  then, after reading the list: `npm run remove-demo:firebase -- --yes --keep you@university.edu`
4. Log in at `/staff` as Admin, then: *Users & Signups > Create staff account* (CEO, HOD, Officer, T&D) and *Student Registration Data > import students*.

| Command | What it does |
|---|---|
| `npm run dev` (same as `dev:firebase`) | API + website on Firebase (uses `apps/api/.env.firebase`, `apps/web/.env.firebase`) |
| `npm run create-admin:firebase -- email password "Name"` | creates / promotes the first Admin |
| `npm run remove-demo:firebase [-- --yes] [-- --keep email]` | deletes leftover demo accounts / records |
| `npm run fix-companies:firebase [-- --yes]` | companies created earlier by Admin/CEO (which wrongly made them the SPOC) get no SPOC, so an officer can self-assign them |
| `npm run deploy` | builds website + API and deploys everything to Firebase (see section 13). Also: `deploy:web`, `deploy:api`, `deploy:rules` |
| `npm run build` | builds website (`apps/web/out`) and API (`apps/api/lib`) without deploying |
| `npm test` | automated API test (runs on its own temporary test store, never touches Firebase) |
| `npm run typecheck` | TypeScript check of API + website |
| `npm run emulators` | optional: free local Firebase emulators (Auth 9099, Firestore 8080; needs Java 11+) |
| `npm run dev:local` | developer mode without Firebase (empty local data in `apps/api/.data`, settings in `apps/api/.env.localdev`) - only for development |

---
## 2. How everything is connected
```
 Browser (student / staff)
   ├─ opens the website ─────────────►  Firebase Hosting      static site built from apps/web  (apps/web/out)
   ├─ signs in / changes password ───►  Firebase Authentication
   └─ every data call  /api/...  ────►  Firebase Hosting ──► Cloud Function "api" (apps/api) ──► Cloud Firestore
                                                              checks token + role                └─► files: Firestore chunks OR Firebase Storage
```
* The website and the API share **one domain** (Hosting forwards `/api/**` to the function), so there is no CORS setup.
* The **browser never reads/writes Firestore**: `firestore.rules` denies all direct access; only the function (Firebase Admin SDK, automatic credentials in the cloud) touches data, after checking the user's role and hierarchy on every request.
* The browser only talks to Firebase **Authentication** (sign-in, change password, forgot-password email).
* On your PC `npm run dev` runs the same code (API on port 4000, website on 3000) against the same Firebase project, using a service-account key.

| File | Used by | Contains |
|---|---|---|
| `apps/api/.env.firebase` | `npm run dev` (API on your PC) | `AUTH_MODE=firebase`, `STORE=firestore`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (path to the service-account JSON, kept **outside** the project), `PORT`, `CORS_ORIGINS`, optional `FIREBASE_STORAGE_BUCKET` |
| `apps/web/.env.firebase` | `npm run dev` (website on your PC) | `NEXT_PUBLIC_API_BASE_URL`, Firebase **Web app** config (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`) |
| `apps/web/.env.production` | `npm run build:web` / `npm run deploy` | same Firebase Web config, API address `/api`, no emulator |
| `apps/api/.env.<project-id>` (here `.env.gu-pms`) | the **deployed** function | `AUTH_MODE`, `STORE`, `CORS_ORIGINS`, optional `GU_STORAGE_BUCKET`. The file name must be your Firebase project id. Names starting `FIREBASE_`, `X_GOOGLE_` and `PORT` are reserved by Firebase - never put them here |
| `apps/api/.env.localdev`, `apps/web/.env.local` | developer mode only | no-Firebase settings (`npm run dev:local`) |
| `firebase.json` | Firebase CLI | Hosting (folder, `/api` → function, cache headers), Functions (source `apps/api`), Firestore rules, emulator ports |
| `firestore.rules`, `.firebaserc` | Firebase CLI | deny-all rules; default project `gu-pms` |

Never share or commit the service-account JSON. The Web app config values are public by design (still restrict the API key to your domain in Google Cloud Console).
**Files (JD PDF, offer letters):** if a Storage bucket is configured (`FIREBASE_STORAGE_BUCKET` on your PC, `GU_STORAGE_BUCKET` in the deployed function) they go to Firebase Storage; otherwise (default) they are stored inside Firestore (max 5 MB each, no extra setup).

---
## 3. Where each thing is stored
| What | Where | Notes |
|---|---|---|
| Login id + password | **Firebase Authentication** | passwords are never stored by us |
| Role, name, profile, hierarchy (`reportsTo`, `path`) | Firestore `users/{uid}` | the role is read from here after sign-in; `mustChangePassword`, `status` (`active` / `blocked`) too |
| Student records fed by Admin (used to verify registration) | Firestore `registry/{ROLLNO}` | roll, name, email, course, session, campus, HOD email, `registered` flag |
| Companies (details, branches, contacts, course salary, SPOC, last visit / hire) | Firestore `companies/{id}` | status Assigned / Not Assigned / Unassigned is calculated from dates |
| Company assignment requests | `assignments/{id}` | Pending → HOD approves |
| Follow-ups | `followups/{id}` | officer's client communication notes |
| Visit requests + feedback | `visits/{id}` | budget, actual spend, explanation |
| Recruitment drives (Draft / floated), invited students, consent, results | `drives/{id}` | `invites[]` holds each student's consent token, consent, ready, result |
| Offer letters (record) / Early joining requests | `offers/{id}` / `eja/{id}` | |
| File records | `files/{id}` | name, type, size, uploader, who may open it |
| File bytes | Firebase Storage `uploads/{id}` **or** Firestore `filechunks/{id}_{n}` | |
| Notifications shown in the bell | `notifications/{id}` (+ some are calculated live) | |
| Password-reset tokens | `resets/{token}` | only developer mode; Firebase mode uses Firebase's reset email |
| Dropdown lists, notices, menu on/off | `config/site` | edited by Admin > Page Settings |
| Audit trail | `audit/{id}` | admin edits, approvals, imports |

---
## 4. Roles and logins
| Page | URL | Who |
|---|---|---|
| Student login + New registration | `/` | students only |
| Admin Login (plain Login ID + password; the role is read from the database and the right panel opens) | `/staff` | Admin, CEO, HOD, Placement Officer, T&D |
| Reset password | `/reset` (developer mode) or Firebase email link | everyone |
| Portal (menu depends on role) | `/portal?p=<module>`, e.g. `/portal?p=drives` | everyone after login |
| Student consent link (no login) | `/consent?t=<token>` | one private link per student per drive |

* **Staff accounts are created only by Admin** (role + initial password). At first login they must set their own password. Staff cannot self-register.
* **Students:** Admin imports the student data (Excel/CSV). A student registers on `/` with roll no + university email (verified against that data), completes the details, sets a password and becomes a *student* account only. Or Admin ticks "create accounts" while importing: all get one common initial password, Admin downloads the credentials list (Excel/CSV), students change it at first login.
* Hierarchy: Admin → CEO → HOD → { Placement Officers, T&D, Students }. Everyone sees only the people/data below them.

---
## 5. File structure
```
gu-pms/
├─ package.json                  root scripts (dev, create-admin, remove-demo, test, ...)
├─ firebase.json  .firebaserc    Firebase CLI config: Hosting + Functions + Firestore + emulators
├─ firestore.rules               deny-all rules (only the API reads/writes)
├─ firestore.indexes.json
├─ scripts/
│  ├─ with-env.mjs               runs a command with a .env file loaded (cross-platform)
│  ├─ run-tests.mjs              `npm test`: starts a temporary test API, runs e2e.mjs, stops it
│  └─ e2e.mjs                    ~90 API checks of the whole workflow
├─ apps/
│  ├─ api/                       ── Node.js + Express API ──
│  │  ├─ .env.firebase           Firebase settings of the API on your PC
│  │  ├─ .env.gu-pms             settings of the deployed function (file name = Firebase project id)
│  │  ├─ tsconfig.build.json     compiles the API to lib/ for Cloud Functions
│  │  ├─ src/
│  │  │  ├─ server.ts            starts the API on your PC (npm run dev)
│  │  │  ├─ functions.ts         the same API as the Firebase Cloud Function "api" (used when deployed)
│  │  │  ├─ runtime.ts           reads env, chooses Firebase / local store and file store
│  │  │  ├─ app.ts               ALL routes + business rules (auth, companies, visits, drives, approvals, files, admin)
│  │  │  ├─ identity.ts          sign-in provider interface (+ local implementation)
│  │  │  ├─ firebase.ts          Firebase Auth + Firestore + Storage implementation
│  │  │  ├─ files.ts             file stores: Firebase Storage / Firestore chunks / disk
│  │  │  ├─ store.ts             data-store interface (+ local JSON store for dev/tests)
│  │  │  ├─ auth.ts              password hash / token helpers (developer mode)
│  │  │  ├─ defaults.ts          dropdown lists from the flowchart (visit types, drive types, rounds, guidelines ...)
│  │  │  └─ cli.ts               create-admin, remove-demo
│  │  └─ test/fixtures.ts        TEST-ONLY sample data used by `npm test` (never loaded in real use)
│  └─ web/                       ── Next.js website ──
│     ├─ .env.firebase           Firebase Web config + API address (on your PC)
│     ├─ .env.production         same config for the deployed site (API at /api)
│     ├─ public/images/gu-logo.png   replace with the real Galgotias logo (same name)
│     └─ src/
│        ├─ app/
│        │  ├─ page.tsx          student login + registration (2-step, verified)
│        │  ├─ staff/page.tsx    Admin Login
│        │  ├─ reset/page.tsx    reset password (developer mode)
│        │  ├─ consent/          student consent without login:  /consent?t=<token>
│        │  └─ portal/           layout (login gate, forced password change) + ONE page that opens a module from the address:  /portal?p=companies/new
│        ├─ features/            one file per module: Dashboard, Companies, FollowUps, Visits, Drives, CalendarView, Approvals,
│        │                       Students, Student2 (offers + early joining), Trackers, Downloads, People (team + profile), Admin
│        ├─ components/          Shell (menu + bell), AuthLayout, ChangePassword, ui (tables, forms, Excel/CSV export), Brand
│        └─ lib/                 api.ts, auth.tsx (Firebase sign-in), files.ts (upload/open), xlsx.ts, csv.ts, geo.ts (country/state/district),
│                                roles.ts (menu + access per role), fields.ts (registration + Student Manager fields), site.ts (name/logo)
```

---
## 6. How it works
**Every request:** website → `Authorization: Bearer <Firebase ID token>` → API verifies the token → loads `users/{uid}` → blocks if `status` is not `active` → checks the role for that route (CEO/Admin can do everything) → applies the hierarchy filter (`scope` list on each record) → reads/writes Firestore.

**Company ownership (slide 4):** officer who creates a company becomes SPOC; the same company can be created again only for a different location. Not visited by the SPOC for 2 years → **Not Assigned**; no hiring visit for 2 years → **Unassigned**. Any officer clicks *Assign to me* → HOD approves (Company Assign Approval) → officer becomes SPOC. A visit feedback refreshes "last visit"; an approved result refreshes "last hire".

**Visit:** officer request (type, date, time, **expected budget**) → HOD *Pass Approvals* → after the visit officer gives feedback; spending above budget needs an explanation.

**Drive lifecycle (slides 7-8):**
```
 Draft (steps 1-7 saved any time, JD PDF uploaded)
   │  step 8: upload student IDs (roll no / email / any unique ID; typed or Excel/CSV) → checks: JD, dates, same course+date conflict, min pool size
   ▼
 Pending ── HOD approves until next midnight (else AUTO-APPROVED) ──► Approved ── invitation + notification to students
   │                                                                   │  students consent till the following midnight (else AUTO "Not Interested")
   └─ Rejected                                                         ▼
                                  consent = Yes → Ready list approved → result upload (only Yes students) → HOD approves result
 Also: Cancelled, Process Not Done.   Preparation time starts 5 days after floating, until the schedule date.
```
**Student consent:** in the portal or via the private `/consent?t=<token>` link (copy it from the drive page). **Offer letter:** a Selected student uploads the file → officer / HOD verifies. **Early joining:** only placed / locked students apply → HOD approves → attendance marked automatically.

**Files:** the browser uploads the raw file to `POST /api/files`; the API checks the real file type (PDF for JD; PDF/JPG/PNG for offers) and size, stores the bytes, saves a record, and returns an id. A file can be opened only by its owner, CEO/Admin, people in the owner's hierarchy, and (for a JD) students invited to / T&D of an approved drive. Downloads carry the login token, so a copied link does not work for others.

**Notifications:** the bell shows calculated reminders (upcoming drive, result pending after the drive date, visit feedback pending, follow-ups due, consent pending) plus stored messages (approvals, invitations, results).

**Exports:** every table has *Excel (.xlsx)* and *CSV*. Drive Tracker has all columns of the flowchart. Student Manager can add the 45 optional columns.

---
## 7. Modules and who can use them
| Module | Admin | CEO | HOD | Officer | T&D | Student |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Dashboard, My Profile, bell notifications | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Company Manager (view) · Downloads | ✔ | ✔ | ✔ | ✔ | | |
| Create Company | ✔ | ✔ | | ✔ | | |
| My Follow-ups | ✔ | ✔ | | ✔ | | |
| Visit Manager | ✔ | ✔ | approves | creates | | |
| Student Manager | ✔ | ✔ | ✔ | ✔ | consent-Yes only | |
| My Drives | ✔ | ✔ | ✔ | ✔ | approved drives | own invitations |
| Recruitment Drive Creation (draft / float) | ✔ | ✔ | | ✔ | | |
| HOD Approval (drives, results) · Company Assign Approval | ✔ | ✔ | ✔ | | | |
| Drive Calendar · Placement Tracker · Drive Tracker · Visit Chart · My Team | ✔ | ✔ | ✔ | ✔ (Calendar..Chart) | | |
| Offer Letter Approval | ✔ | ✔ | ✔ | ✔ | | upload |
| Early Joining | ✔ | ✔ | approves | | | apply |
| Users & Signups · Student Registration Data · Data Editor · Page Settings · Audit Log | ✔ | | | | | |

**Company edit rights:** a company opens **read-only**; an *Edit* button appears only for people allowed to change it - the **SPOC officer** of that company, the **HOD of that officer** (not other HODs, and not companies without an officer), the **CEO** and the **Admin** (both have write access to everything). Everyone else sees "View only". Every edit stores who changed it ("Last update ... by ...") and is written to the Audit Log. A company created by an **officer** makes that officer the SPOC; when **Admin/CEO** creates one they either pick an officer as SPOC or leave it empty (status *Not Assigned*, any officer can self-assign it with HOD approval).
**Students and T&D never get company data** - not in the menu and not from the API.

---
## 8. API list (all under `/api`, JSON; "CEO/Admin" can always do what an officer/HOD can)
Public: `POST auth/verify-student`, `auth/register-student`, `auth/forgot`, `auth/reset`, `auth/login` (developer mode), `GET/POST public/consent/:token`.
Any login: `GET me, config, people, visits, drives, offers, eja, notifications, files/:id` · `POST auth/change-password, me/password-changed, files`.
HOD / Officer (CEO, Admin): `GET companies` (with `canEdit` for you).
Officer: `POST companies, companies/:id/assign, followups, visits, visits/:id/feedback, drives, drives/:id/save, drives/:id/ready, drives/:id/result` · `DELETE drives/:id/draft` · `PUT companies/:id` (SPOC/HOD).
HOD: `GET approvals` · `POST drives/:id/decision, drives/:id/result-decision, assignments/:id/decision, visits/:id/decision, eja/:id/decision, offers/:id/decision`.
Student: `POST drives/:id/consent, offers, eja`. HOD/Officer/T&D: `GET students`. Officer/HOD: `GET calendar`.
Admin: `POST admin/staff, admin/students/import, admin/users/:id/reset-password` · `GET/PUT/DELETE admin/:collection(/:id)`.

---
## 9. Admin daily tasks
* **New staff member:** Users & Signups → Create staff account (role, name, email, initial password, reports-to). Tell them the email + initial password.
* **Students (new batch):** Student Registration Data → download the Excel template → fill → upload → choose the default HOD → tick *create login accounts* (optional) → Import → download the credentials list.
* **Forgot password:** the user clicks *Forgot password?* (Firebase emails the link), or Admin → Users → *Reset pw* (sets a temporary password; user must change it).
* **Block / unblock:** Users & Signups → Block / Activate.
* **Change a dropdown list, a notice, or hide a menu item:** Page Settings. **Fix any record:** Data Editor (use carefully; every edit is in the Audit Log).
* **Logo and name:** replace `apps/web/public/images/gu-logo.png`; names are in `apps/web/src/lib/site.ts`.

---
## 10. Tests
`npm test` starts a temporary API in developer mode with built-in test data, runs ~90 checks (login gates, registration, company rules, drives, drafts, files, consent, results, offers, early joining, exports' data, admin tools) and stops. It never uses your Firebase project.

---
## 11. Troubleshooting
| Problem | Fix |
|---|---|
| `EADDRINUSE 4000` / `3000` | another copy is running - close it, or change `PORT` |
| API: "Could not load the default credentials" / file not found | `GOOGLE_APPLICATION_CREDENTIALS` path in `apps/api/.env.firebase` is wrong |
| API: "Failed to determine project ID" | set `FIREBASE_PROJECT_ID` |
| Login says "Invalid email or password" for a new staff | create the account in Users & Signups first; check the email spelling |
| Browser: `auth/invalid-api-key` or CORS error | check `apps/web/.env.firebase` values and `CORS_ORIGINS=http://localhost:3000` in the API env; restart `npm run dev` after editing env files |
| "Account pending / blocked" | Admin → Users & Signups → Activate |
| Upload fails "Storage" | leave `FIREBASE_STORAGE_BUCKET` commented to use Firestore storage, or enable Storage in the console and set the bucket name |
| Firestore "NOT_FOUND" / permission | create the Firestore database (Native mode) in the Firebase console; the API uses the service account, not the rules |

---
## 12. Status and what is not done
**Tested here:** API workflow (~90 checks) · real-browser tests of login, registration, staff and student flows, drafts, JD / offer upload and download, Excel/CSV import and export, geo dropdowns · the same API and browser flows against the **Firebase Authentication emulator** (account creation, sign-in, password change/reset, block, token role check) · the Firestore-chunk file store (3 MB file round trip) · the whole Firebase setup (Hosting + Cloud Function + Auth) on the Firebase emulators (section 13).
**Not tested by me:** Cloud Firestore and Firebase Storage on a real project (my environment cannot reach them; you run it on your project), Excel files from every Excel version.
**Not done yet (ask if you want them):** server-side enforcement of "must change password" and login rate-limiting / captcha, stronger password rule (8+), scheduled job for auto-approve/auto-"Not Interested" (today it is applied whenever the data is read), faster Firestore queries + pagination for thousands of students, email / WhatsApp sending of invitations and consent links, Media-team / administrative-officer notification roles, daily Firestore backup (the deploy itself is ready: section 13).

---
## 13. Deploy to the internet - everything on Firebase
One command, only the Firebase CLI (no Docker, no gcloud): `npm run deploy` builds the website, builds the API, and uploads **Hosting** (website), the **Cloud Function** `api`, and the **Firestore rules**.

**Before you start (one time)**
1. The Firebase project must be on the **Blaze** plan (Cloud Functions need billing; a college portal costs little, and a free monthly quota applies).
2. In the Firebase console make sure these exist: *Authentication* (Email/Password on), *Firestore Database*, and open *Build > Hosting > Get started* once.
3. Node.js 20+ on your PC, then log in: `npx firebase-tools@13 login`.
4. Check the names: `.firebaserc` = your project id (`gu-pms`); `apps/api/.env.gu-pms` must be named `.env.<your project id>`; inside it `CORS_ORIGINS` lists your site address(es). If your project id is different, rename the file and fix `.firebaserc`, and the two addresses (`https://<project-id>.web.app`).

**Deploy**
```powershell
npm run install:all      # once, or after the code changed packages
npm run deploy           # first time takes 5-10 minutes
```
Answer *Yes* if it asks to enable APIs (Cloud Functions, Cloud Build, Artifact Registry...). If it asks about a cleanup policy for container images, accept the suggested number of days. When it finishes, open **https://gu-pms.web.app** (your project id instead of `gu-pms`).

**After the first deploy**
```powershell
npm run create-admin:firebase -- admin@university.edu "StrongPassword" "Admin Name"   # first Admin (runs on your PC)
npm run remove-demo:firebase                                                          # shows leftover demo data; add  -- --yes --keep admin@university.edu  to delete
```
Check: open the site → *Admin Login* → create a staff account → log in as that staff (forced password change) → *Student Registration Data* → import a few students → register one student on the main page → create a company → draft a drive, upload the JD, float it.

**Your own domain:** Firebase console → Hosting → *Add custom domain* → add the DNS records it shows → when it is active, add the domain under *Authentication → Settings → Authorized domains* and add `https://yourdomain` to `CORS_ORIGINS` in `apps/api/.env.gu-pms`, then `npm run deploy:api`.

**Updating later**
| You changed | Run |
|---|---|
| anything on the website | `npm run deploy:web` |
| anything in the API | `npm run deploy:api` |
| `firestore.rules` | `npm run deploy:rules` |
| not sure / several | `npm run deploy` |

Logs: Firebase console → *Functions* → `api` → *Logs* (or `npx firebase-tools@13 functions:log`).

**Good to know**
* `npm run dev` on your PC and the live site use the **same Firebase project and data**. Create a second Firebase project for testing before real students use the portal (copy the settings, change `.firebaserc` / env files).
* The first request after a quiet period takes a few seconds (cold start). To avoid it set `minInstances: 1` in `apps/api/src/functions.ts` (small monthly cost). Set a **budget alert** in Google Cloud Billing.
* The function uses its own automatic Firebase credentials. If login works but the pages show "PERMISSION_DENIED", open Google Cloud console → IAM → find the service account `<project-number>-compute@developer.gserviceaccount.com` → give it *Firebase Authentication Admin* and *Cloud Datastore User*.
* Student consent links changed form to `/consent?t=<token>`; links copied from an older version stop working (copy the link again from the drive page).

| Problem | Fix |
|---|---|
| `firebase deploy` says billing / "must be on the Blaze plan" | upgrade the project to Blaze |
| Hosting deploy: "Hosting not set up" | console → Build → Hosting → Get started, then deploy again |
| Site opens but every call shows "Server error" | Functions → `api` → Logs; usually `apps/api/.env.<project-id>` has the wrong file name or a reserved name |
| `auth/unauthorized-domain` | add the domain to Authentication → Authorized domains |
| API call returns 404 / HTML instead of JSON | the function was not deployed, or its region is not `asia-south1` (must match `firebase.json` and `functions.ts`) |
| Old page after a deploy | hard refresh (Ctrl+F5) |

**Checked here:** I ran the **Firebase emulators for Authentication + Cloud Functions + Hosting** with the exact `firebase.json`, the compiled API and the exported website: the whole API workflow (97 checks, including file upload through the function) and a real-browser test (32 checks: every login, staff creation with forced password change, bulk import, registration, forgot password, JD upload, deep links, consent page, `/student` is 404) all passed; the production website build contains only `/api` and your Firebase project (no localhost). **Not run by me:** the real `firebase deploy` (needs your Google account), and Firestore / Storage on a live project.
