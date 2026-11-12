# Alaga: Pet Community of the Marinduque Provincial Veterinary Office

**Alaga** ("care" in Filipino) is a full stack pet community and pet management platform for the Provincial Veterinary Office (PVO) of Marinduque. Pet owners register their pets and keep their vaccination and medical records in one place, share updates on a community wall, follow PVO vaccination drives and advisories, and report animal bites, missing pets, strays and welfare concerns online. PVO staff verify registrations, manage reports and publish schedules from an admin console.

- **Frontend:** HTML, CSS, JavaScript (ES modules, no build step), in `/client`
- **Backend:** Node.js + Express.js REST API, in `/server`
- **Database:** MongoDB via Mongoose

Project write-up (target user, introduction, problem, objectives, scope, limitations, solution, system description): **[DOCUMENTATION.md](DOCUMENTATION.md)**

## Features

- **Pet registration:** each pet gets a PVO registration number (`MQ-2026-00001`), up to 6 photos and a public profile; PVO staff verify registrations
- **Health records:** vaccination record and medical history per pet, private to the owner and the PVO; anti-rabies status (up to date, overdue, none) computed from the record; owner entries are marked until the PVO verifies them
- **Community wall:** opens with a welcome, other owners' pets, upcoming schedules, announcements and a mixed "For you" feed (or "Latest"); owners post text, up to 4 photos, or both, under their own name; likes, comments and moderation by the PVO
- **Alagai, the pet-care helper:** a chat for logged-in users that answers from built-in pet-care topics (feeding, grooming, vaccines, deworming, ticks and fleas, behaviour, kapon, signs of sickness, PVO services) and live data (the next PVO activities, the user's pets' anti-rabies status); no AI; it says it is not a veterinarian, never diagnoses or prescribes, and shows the emergency hotline for urgent questions
- **Messages:** staff answer contact messages with written replies that senders read under Account → Messages (with a new-reply dot); messages are archived and restored, never deleted
- **Pet directory:** search and filter by species, municipality and sex, with sorting and paging; filter state lives in the URL so views can be shared
- **Announcements and schedules:** vaccination drives, deworming days, free programs and advisories, with "add to my calendar" (.ics)
- **Online reporting:** animal bites (always high priority), missing pets (with an optional public alert on the wall), strays and welfare concerns; each report gets a reference number and a status timeline the reporter can track, and can be withdrawn until the PVO starts on it
- **PVO admin console:** dashboard (registrations, anti-rabies coverage, open reports, monthly charts), pet registry, case management with notes to the reporter, announcement editor, account moderation (suspend or delete) and contact inbox
- **Privacy by default:** visitors see only a pet's profile and the owner's first name; health records and contact details stay private
- **Security:** bcrypt passwords, JWT sessions that end when a password changes or an account is suspended, rate limits on login, posting, reports and uploads, a Content-Security-Policy, and uploads checked by their real file type
- Responsive layout, light and dark themes, accessible forms, focus states and reduced-motion support

## Running it locally

**Requirements:** [Node.js 18+](https://nodejs.org) and MongoDB, either local ([Community Server](https://www.mongodb.com/try/download/community)) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
npm install                          # at the repo root (npm workspace: installs the server's packages)
cp server/.env.example server/.env   # then edit MONGO_URI and JWT_SECRET (16+ characters)
npm run seed                         # demo data: a PVO admin, 6 owners, 16 pets, posts, announcements, reports
npm start                            # http://localhost:5000
```

Open **http://localhost:5000**. The Express server serves the API under `/api` and the website from `/client`. `npm run seed` clears this app's collections first, so only run it on a database you can reset.

| Account | Email | Password |
|---|---|---|
| PVO admin | `admin@alaga.ph` | `Admin123!` |
| Pet owner | `maria@example.com` (also `jose@`, `ana@`, `carlo@`, `liza@`, `paolo@`) | `Owner123!` |

Never commit `server/.env`: `.gitignore` excludes every `.env` file except the `.env.example` template.

## Deploying on Vercel

The repo deploys to Vercel as-is (`vercel.json`): `client/` is served as static files and every `/api/*` request runs the Express app as one Vercel Function (`api/index.js`). Pushing to `main` deploys to production.

| Variable | Where it comes from |
|---|---|
| `MONGODB_URI` | MongoDB Atlas integration from the Vercel Marketplace (or set `MONGO_URI` yourself) |
| `JWT_SECRET` | A long random string, added as a sensitive variable |
| `BLOB_READ_WRITE_TOKEN` | The connected Vercel Blob store; uploaded photos are saved there because Vercel's filesystem is read-only |

To load the demo data into the cloud database, run the seed once with that connection string: `MONGO_URI="<atlas uri>" npm run seed` (inside `server/`).

## Project structure

```
client/                       Frontend (static)
  index.html                  Community wall (home)
  pets.html  pet.html         Pet directory, pet profile + health records
  pet-form.html               Register / edit a pet
  announcements.html          PVO news and scheduled activities
  report.html                 File an incident report
  account.html                Log in / sign up, my pets, my reports, profile
  services.html  about.html  contact.html  admin.html  404.html
  assets/css/styles.css       Design tokens, light/dark themes, layout
  assets/js/api.js            fetch wrapper (JSON, JWT, errors)
  assets/js/store.js          Login session in localStorage
  assets/js/config.js         Site details and labels for every enum
  assets/js/ui.js  nav.js     Page bootstrap, header, footer, toasts, forms
  assets/js/components.js     Pet cards, wall posts, schedules, report cards
  assets/js/assistant.js      Alagai chat panel
  assets/js/pages/*.js        One script per page
  assets/img/                 Wikimedia Commons photos + credits.json
server/                       Backend
  src/server.js               Entry: env, DB connect, listen
  src/app.js                  Express app, routes, static client
  src/config/                 DB connection, shared constants (municipalities…)
  src/models/                 User, Pet, Post, Announcement, Report, ContactMessage, Counter
  src/controllers/            Request handlers
  src/routes/                 URL → controller mapping
  src/middleware/             auth (JWT, roles), rate limit, security headers, errors
  src/utils/                  Input validation helpers
  seed/                       Demo data + seed script
  .env.example                Environment variables template
api/index.js                  Vercel Function entry (wraps the Express app)
vercel.json                   Vercel config: static client, /api rewrite, security headers
docs/                         Assignment instructions and rubric
```

## REST API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/users/register` | Public | Create a pet owner account |
| POST | `/api/users/login` | Public | Log in, returns JWT |
| GET / PUT | `/api/users/me` | User | View / update own profile, change password |
| GET | `/api/users` | Admin | Accounts with pet and report counts |
| PATCH | `/api/users/:id/ban` | Admin | Suspend / restore an owner |
| DELETE | `/api/users/:id` | Admin | Delete an owner, their pets and posts |
| GET | `/api/pets` | Public | Directory with `q`, `species`, `municipality`, `sex`, `sort`, `page`, `limit` |
| GET | `/api/pets/mine` | User | Own pets |
| GET | `/api/pets/:id` | Public* | Profile (*private pets: owner and PVO only) |
| POST | `/api/pets` | Owner | Register a pet |
| PUT / DELETE | `/api/pets/:id` | Owner / Admin | Edit / remove a pet |
| PATCH | `/api/pets/:id/verify` | Admin | Verify a registration |
| POST | `/api/pets/:id/vaccinations` | Owner / Admin | Add a vaccination |
| PATCH | `/api/pets/:id/vaccinations/:vid/verify` | Admin | Verify a vaccination |
| DELETE | `/api/pets/:id/vaccinations/:vid` | Owner / Admin | Remove a vaccination |
| POST / DELETE | `/api/pets/:id/medical[/:mid]` | Owner / Admin | Add / remove a medical record |
| GET | `/api/posts` | Public | Wall posts (`pet`, `page`, `limit`, `order=latest\|discover`, `seed`) |
| POST | `/api/posts` | Owner | Post text, up to 4 `photos`, or both; `pet` optional |
| DELETE | `/api/posts/:id` | Author / Admin | Delete a post |
| POST | `/api/posts/:id/like` | User | Like / unlike |
| POST / DELETE | `/api/posts/:id/comments[/:cid]` | User | Add / delete a comment |
| GET | `/api/announcements` | Public | News and schedules (`category`, `upcoming`, `q`) |
| POST / PUT / DELETE | `/api/announcements[/:id]` | Admin | Manage announcements |
| GET | `/api/reports/alerts` | Public | Open missing-pet alerts |
| POST | `/api/reports` | Owner | File a report |
| GET | `/api/reports/mine` | User | Own reports with timelines |
| GET | `/api/reports/:id` | Reporter / Admin | One report |
| PATCH | `/api/reports/:id/withdraw` | Reporter | Withdraw before the PVO starts |
| GET | `/api/reports` | Admin | All reports (`status`, `type`, `municipality`, `q`) |
| PATCH | `/api/reports/:id` | Admin | Update status, add a note, toggle public alert |
| POST | `/api/contact` | Public | Send a message (linked to the account when logged in) |
| GET | `/api/contact/mine` | User | Own messages with the PVO's replies |
| GET / PATCH | `/api/contact/mine/unread`, `/api/contact/mine/read` | User | New-reply count; mark replies read |
| GET | `/api/contact` | Admin | Inbox (`box=inbox\|archived\|all`) |
| POST | `/api/contact/:id/replies` | Admin | Send a written reply (marks the message replied) |
| PATCH | `/api/contact/:id` | Admin | Archive or restore (`{ archived }`); there is no delete |
| POST | `/api/assistant/chat` | User | Ask Alagai (`messages: [{ role, content }]`) |
| GET | `/api/admin/stats` | Admin | Dashboard numbers and monthly series |
| POST | `/api/uploads` | User | Upload a photo (multipart field `image`, JPG/PNG/WebP, 4 MB) |

Errors always come back as `{ "message": "...", "details": { field: message } }` with a matching HTTP status.

## Image credits

All photos come from [Wikimedia Commons](https://commons.wikimedia.org) under CC0, public domain, CC BY or CC BY-SA licences and were resized for the web. Author, licence and source for every image are listed in `client/assets/img/credits.json` and on the site's About page.

## Disclaimer

Student project. Alaga is not an official government website and is not operated by the Provincial Government of Marinduque. All people, pets, records, incidents and contact numbers are sample data.
