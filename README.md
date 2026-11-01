# Voltyard Motors: Tesla Online Shop

A full stack e-commerce site for **Voltyard Motors**, a fictional independent Tesla dealer in Mogpog, Marinduque. Shoppers browse new, pre-owned and pre-order Teslas, reserve a car with a refundable deposit, buy chargers and parts, and book test drives. Staff run everything from an admin panel.

- **Frontend:** HTML, CSS, JavaScript (ES modules, no build step), in `/client`
- **Backend:** Node.js + Express.js REST API, in `/server`
- **Database:** MongoDB via Mongoose

Project write-up (introduction, problem, objectives, scope, limitations, solution, system description): **[DOCUMENTATION.md](DOCUMENTATION.md)**

## Features

- Inventory with filters (model, condition, price, range), search, sort and pagination; filter state lives in the URL so views can be shared
- Product pages with a full spec sheet and a battery health gauge for pre-owned cars
- Pre-order listing for the second-generation Roadster with the SpaceX Package (the "flying" Tesla), clearly marked as not yet in production
- Cart showing the deposit due now and the balance due at handover
- Accounts: register, log in (JWT), order history, cancel pending orders, edit profile
- Double-booking protection: a car is locked in the database the moment it is ordered
- Contact form for test drives, financing and trade-ins, linked to a specific car
- Admin lot console (admins land here after login): today's to-do queue, lot status bar, inline status and stock changes, order pipeline (pending → confirmed → ready → completed), customer inbox, number-key shortcuts
- Sales view: completed sales, deposits, open pipeline, cars sold, weekly sales chart (4/12/26 weeks), revenue by model, orders by status, table view
- Photo upload for listings (drag and drop, JPG/PNG/WebP up to 5 MB, file type checked on the server)
- Only customer accounts can place orders; admins manage them
- Responsive layout, light and dark themes, accessible forms and focus states

## Running it locally

**Requirements:** [Node.js 18+](https://nodejs.org) and MongoDB, either local ([Community Server](https://www.mongodb.com/try/download/community)) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

```bash
cd server
npm install
cp .env.example .env      # then edit MONGO_URI (and JWT_SECRET)
npm run seed              # loads 14 vehicles, 5 accessories, an admin and a demo customer
npm start                 # http://localhost:5000
```

Open **http://localhost:5000**. The Express server serves the API under `/api` and the website from `/client`.

| Account | Email | Password |
|---|---|---|
| Admin | `admin@voltyard.ph` | `Admin123!` |
| Customer | `juan@example.com` | `Customer123!` |

## Project structure

```
client/                     Frontend (static)
  index.html  products.html  product.html  cart.html
  account.html  about.html  contact.html  admin.html  404.html
  assets/css/styles.css     Design tokens, light/dark themes, layout
  assets/js/api.js          fetch wrapper (JSON, JWT, errors)
  assets/js/store.js        Session + cart in localStorage
  assets/js/ui.js           Header/footer, cards, formatters, toasts
  assets/js/pages/*.js      One script per page
  assets/img/               Wikimedia Commons photos + credits.json
server/                     Backend
  src/server.js             Entry: env, DB connect, listen
  src/app.js                Express app, routes, static client
  src/config/db.js          Mongoose connection
  src/models/               Product, User, Order, ContactMessage
  src/controllers/          Request handlers
  src/routes/               URL → controller mapping
  src/middleware/           auth (JWT, admin), error handler
  seed/                     Starter inventory + seed script
  .env.example              Environment variables template
docs/                       Assignment instructions and rubric
```

## REST API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/products` | Public | List with `category`, `model`, `condition`, `minPrice`, `maxPrice`, `minRange`, `q`, `sort`, `page`, `limit` |
| GET | `/api/products/:idOrSlug` | Public | One product plus related items |
| POST | `/api/products` | Admin | Create listing |
| PUT | `/api/products/:id` | Admin | Update listing |
| DELETE | `/api/products/:id` | Admin | Delete listing |
| POST | `/api/users/register` | Public | Create customer account |
| POST | `/api/users/login` | Public | Log in, returns JWT |
| GET / PUT | `/api/users/me` | User | View / update own profile |
| GET | `/api/users` | Admin | List users |
| POST | `/api/contact` | Public | Send enquiry |
| GET | `/api/contact` | Admin | List enquiries |
| PATCH / DELETE | `/api/contact/:id` | Admin | Update status / delete |
| POST | `/api/orders` | User | Place order (reserves cars, takes stock) |
| GET | `/api/orders/mine` | User | Own orders |
| GET | `/api/orders/:id` | Owner / Admin | One order |
| PATCH | `/api/orders/:id/cancel` | Owner | Cancel a pending order |
| GET | `/api/orders` | Admin | All orders |
| PATCH | `/api/orders/:id/status` | Admin | pending → confirmed → ready → completed / cancelled |
| GET | `/api/admin/stats` | Admin | Dashboard numbers |
| POST | `/api/uploads` | Admin | Upload a listing photo (multipart field `image`) |
| GET | `/api/admin/sales?weeks=12` | Admin | Sales totals, weekly series, revenue by model, orders by status |

Errors always come back as `{ "message": "...", "details": { field: message } }` with a matching HTTP status.

## Image credits

All photos come from [Wikimedia Commons](https://commons.wikimedia.org) under CC0, CC BY 2.0 or CC BY-SA 4.0 licences and were resized for the web. Author, licence and source for every image are listed in `client/assets/img/credits.json` and on the site's About page.

## Disclaimer

Student project. Voltyard Motors is fictional and is not affiliated with Tesla, Inc. Tesla, Model 3, Model Y, Model S, Model X, Cybertruck and Roadster are trademarks of Tesla, Inc. Prices and inventory are sample data.
