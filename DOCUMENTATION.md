# Alaga: Project Documentation

Pet community and pet management platform for the Provincial Veterinary Office of Marinduque.
Stack: HTML/CSS/JavaScript · Node.js + Express.js · MongoDB (Mongoose) · REST API

---

## Target User / Organization

| | |
|---|---|
| **Organization name** | Provincial Veterinary Office (PVO) of Marinduque (the platform is a student project, not an official government site) |
| **Organization type** | Local government office under the Provincial Government of Marinduque |
| **Industry** | Public animal health and veterinary services |
| **Services** | Pet registration, free anti-rabies vaccination drives, deworming days, spay and neuter (kapon) programs, veterinary consultation, handling of animal bite, stray, missing-pet and animal welfare cases, and health advisories for pet owners. |
| **Target audience** | Pet owners across the six municipalities of Marinduque (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos), residents who need to report an animal bite or an animal in need, and PVO staff who keep the province's pet and vaccination records. |
| **Organization goals** | Vaccinate every dog and cat against rabies every year, keep registration and vaccination records that follow the pet, reduce strays, and respond to bites, missing pets and welfare cases quickly. |
| **Website purpose** | Community and service platform: register pets and keep their health records, share pet updates, publish schedules and advisories, and receive and track incident reports online. |

### Organization brief

The Marinduque Provincial Veterinary Office protects animal and public health across the island's six municipalities. Pet registrations have lived in paper logbooks, vaccination drives are announced by word of mouth or posters at the barangay hall, and incidents such as dog bites are reported by phone or in person at the Capitol in Boac. Owners in far barangays often miss drives they did not hear about, and staff spend hours looking up records by hand. The office needs a website where owners register their pets once, see their pets' vaccination status, learn about upcoming drives, and report incidents that reach the right team and can be tracked.

---

## 1. Introduction

This project is a full stack web application developed for the Marinduque Provincial Veterinary Office, designed to bring pet registration, health records, PVO announcements and incident reporting online in a single community platform called **Alaga** ("care" in Filipino). It uses HTML, CSS and JavaScript for the frontend, Node.js with Express.js for a RESTful API, and MongoDB through Mongoose for data storage.

The website is a **community and public-service** platform. Pet owners create an account, register their pets, keep vaccination and medical records, post updates on a community wall written "as" their pet, and file reports. Visitors can browse public pet profiles and PVO announcements without an account. PVO staff manage registrations, reports, announcements and accounts from an admin console.

## 2. Problem Statement

The Marinduque PVO currently faces challenges such as pet registrations and vaccination records kept in paper logbooks, vaccination drives announced only by word of mouth, and incident reports that arrive by phone or in person with no way for the reporter to follow up. This limits the office's ability to reach owners in all six municipalities, makes it hard to know which pets are due for an anti-rabies booster, and leaves bite victims and owners of missing pets without updates.

Owners also have no single place to see their pets' records: vaccination cards get lost, and a pet's history does not follow it from one clinic to another. A digital solution that gives every pet a registration number and a health record, publishes schedules where owners already spend time, and turns each incident into a tracked case solves the record, reach and follow-up problems together.

## 3. Objectives

- Develop a responsive website that works on phones, tablets and desktops
- Build a backend REST API with Node.js and Express.js
- Store and retrieve users, pets, health records, posts, announcements, reports and messages in a MongoDB database
- Let owners register pets, keep vaccination and medical records, and see each pet's anti-rabies status
- Let anyone with an account report bites, missing pets, strays and welfare concerns and track each report's status
- Give PVO staff an admin console to verify registrations, manage cases, publish announcements and moderate the community
- Protect personal data: health records and contact details are visible only to the owner and the PVO
- Prepare the system for online deployment

## 4. Scope

The system includes the pages Community Wall (Home), Pets (directory), Pet Profile, Register/Edit Pet, Announcements, Services, Report an Incident, Account, About, Contact and a PVO Admin console. It allows users to:

- Browse public pet profiles, filtered by species, municipality and sex, with search, sorting and paging
- Create an owner account, register pets (photos, breed, sex, birth date, municipality), and receive a PVO registration number
- Keep each pet's vaccination record and medical history; see whether the anti-rabies vaccine is up to date or overdue
- See an active community wall right after logging in: other owners' pets, upcoming schedules, announcements and a mixed feed of posts
- Post text, photos (up to four) or both on the wall under their own name, and like and comment on other posts
- Ask Alagai, a built-in pet-care helper (no AI), about feeding, grooming, vaccination, deworming, behaviour, common signs of sickness, PVO services, the next PVO activities and their pets' anti-rabies status; Alagai says it is not a veterinarian, does not diagnose or prescribe, and sends urgent cases to a vet or the PVO hotline
- Read PVO announcements and upcoming schedules, and save scheduled activities to a phone calendar
- File a report (animal bite, missing pet, stray, welfare concern) with photos, location and contact details, receive a reference number, follow the status timeline, and withdraw a report before the PVO starts on it; owners of missing pets can share a public alert on the wall
- Send a message to the PVO through the contact form and read the office's written replies under Account → Messages
- (PVO staff) Sign in to the admin console, see a dashboard (registrations, anti-rabies coverage, open and high-priority reports, monthly charts), verify registrations and vaccinations, record vaccinations, update reports with notes the reporter can read, publish and schedule announcements, suspend or delete accounts, remove posts and comments, and answer contact messages with written replies, archiving and restoring them (messages are never deleted). Staff accounts cannot register pets or file reports.

## 5. Limitations

- No email or SMS notifications: owners see report updates, message replies and schedules when they open the site. Replies to visitors who were not logged in are saved, but staff must also answer them by email.
- Alagai answers from a fixed set of pet-care topics, so questions outside them get a list of what it can help with. It gives general information only and is not a substitute for a veterinarian.
- No real-time chat between owners and PVO staff.
- No online payment, since the PVO's listed programs are free.
- A single staff role: no separate permission levels for veterinarians, encoders or supervisors, and no audit log.
- Owner-entered vaccinations remain "owner entries" until staff verify them in person; the system cannot check a paper vaccination card on its own.
- Photos are limited to 4 MB each, because Vercel caps request bodies at 4.5 MB.
- Rate limiting is kept in memory, which is enough for one server process but not for several.
- People, pets, records, incidents and contact numbers in the demo are sample data.

## 6. Proposed Solution

To address the problem, a web-based system is developed using modern technologies. Owners register their pets once and carry their records online, the PVO publishes schedules where owners already look, and every incident becomes a numbered case that both the reporter and the office can follow.

At a high level:

1. The browser loads static pages from the `/client` folder.
2. Page scripts call the REST API with `fetch()` (for example `GET /api/pets?species=dog&municipality=Boac`).
3. The Express server validates the request, reads or writes MongoDB through Mongoose models, and returns JSON shaped for the viewer: visitors get public fields only, owners also get their pets' health records, and staff also get owner contact details.
4. Registration numbers (`MQ-2026-00001`) and report references (`RPT-2600001`) come from an atomic counter, so two requests can never receive the same number.
5. A missing-pet report marks the pet as missing; resolving or closing the report makes it active again. Report updates are written together with their timeline entry in one atomic update, and an update is refused if someone else changed the report a moment earlier.
6. Logged-in users are identified by a JSON Web Token. The user is reloaded on every request, so a suspension or a password change takes effect immediately. Role checks (owner or admin) happen on the server.

## 7. System Description

**Frontend (what users see).** Plain HTML, CSS and JavaScript ES modules in `/client`, with no build step. Shared modules render the header and footer (`nav.js`, `ui.js`), pet cards, wall posts, schedules and report timelines (`components.js`). Each page has its own script in `assets/js/pages/`. The login session is kept in `localStorage`. The layout is responsive down to phone width, supports light and dark themes, and respects reduced-motion settings. All photos are free-licence images from Wikimedia Commons, credited on the About page.

**Backend (logic and API).** Node.js with Express.js in `/server/src`, organised as `models → controllers → routes`, with middleware for authentication (`protect`, `adminOnly`, `ownerOnly`, `optionalAuth`), rate limiting, security headers and central error handling. Passwords are hashed with bcrypt. Routes:

| Resource | Endpoints |
|---|---|
| Users | `POST /api/users/register`, `POST /api/users/login`, `GET/PUT /api/users/me`, `GET /api/users` (admin), `PATCH /api/users/:id/ban` (admin), `DELETE /api/users/:id` (admin) |
| Pets | `GET /api/pets`, `GET /api/pets/mine`, `GET /api/pets/:id`, `POST /api/pets`, `PUT/DELETE /api/pets/:id`, `PATCH /api/pets/:id/verify` (admin), vaccinations and medical records under `/api/pets/:id/…` |
| Posts | `GET /api/posts`, `POST /api/posts`, `DELETE /api/posts/:id`, `POST /api/posts/:id/like`, `POST/DELETE /api/posts/:id/comments[/:cid]` |
| Announcements | `GET /api/announcements`, `GET /api/announcements/:id`, `POST/PUT/DELETE` (admin) |
| Reports | `GET /api/reports/alerts`, `POST /api/reports`, `GET /api/reports/mine`, `GET /api/reports/:id`, `PATCH /api/reports/:id/withdraw`, `GET /api/reports` (admin), `PATCH /api/reports/:id` (admin) |
| Contact | `POST /api/contact`, `GET /api/contact/mine`, `GET /api/contact` (admin), `POST /api/contact/:id/replies` (admin), `PATCH /api/contact/:id` archive or restore (admin) |
| Admin | `GET /api/admin/stats`, `POST /api/uploads` (photo upload) |
| Assistant | `POST /api/assistant/chat` (Alagai; logged-in users) |

**Database (data storage).** MongoDB with seven collections defined by Mongoose schemas:

- `users`: name, email, hashed password, phone, municipality, barangay, role (owner or admin), suspension status
- `pets`: owner, name, species, breed, sex, birth date, colour, photos, bio, municipality, registration number and status, visibility, status (active, missing, deceased), embedded vaccinations and medical history
- `posts`: author, optional pet, text, up to four photos, likes, embedded comments
- `announcements`: title, category, body, image, optional scheduled event (start, end, venue, municipality), pinned, published
- `reports`: reference, reporter, type, species, linked pet, description, incident date, location, photos, contact, priority, status, status history, public alert
- `contactmessages`: sender account (when logged in), name, email, phone, topic, message, status (new or replied), embedded staff replies, unread flag for the sender, archived flag and date
- `counters`: sequences for registration numbers and report references

**Deployment (where it is hosted).** The site is deployed on **Vercel**. The `/client` folder is served as static files from Vercel's CDN, and the Express API runs as a single Vercel Function (`api/index.js`) that every `/api/*` request is rewritten to. Data lives in **MongoDB Atlas**, provisioned through the Vercel Marketplace, and uploaded photos are stored in **Vercel Blob** because a function's filesystem is read-only. Pushing to the `main` branch on GitHub deploys a new production version automatically. Locally, `npm start` runs the same Express app with a local MongoDB and saves photos to disk.
