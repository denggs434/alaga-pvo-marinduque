# Voltyard Motors: Project Documentation

Full stack e-commerce website for a Tesla dealer.
Stack: HTML/CSS/JavaScript · Node.js + Express.js · MongoDB (Mongoose) · REST API

---

## Target User / Organization

| | |
|---|---|
| **Company name** | Voltyard Motors (fictional company) |
| **Company type** | Small business, an independent car dealer |
| **Industry** | Automotive |
| **Services** | Sells new imported and certified pre-owned Tesla vehicles (Model 3, Model Y, Model S, Model X, Cybertruck, Roadster), takes pre-orders for upcoming Tesla models, sells home and commercial chargers, wheels and parts, books test drives, makes trade-in offers and arranges financing. |
| **Target audience** | First-time EV buyers across Marinduque (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos), OFW families buying a family car, enthusiasts and collectors, and resorts and businesses installing destination chargers. |
| **Company goals** | Reach buyers outside the showroom, show live inventory with honest battery data, take reservations online, and reduce time spent answering the same questions by phone. |
| **Website purpose** | Sell products: reserve vehicles with a deposit, buy accessories, and collect test-drive, financing and trade-in leads. |

### Company brief

Voltyard Motors is an independent Tesla dealer in Mogpog, Marinduque, near Balanacan Port, that sells new imported and battery-tested pre-owned Teslas, along with chargers and parts. Every pre-owned car is sold with a printed battery health test. Because Marinduque is an island province, most buyers would otherwise have to take the RoRo to Lucena and drive to Manila just to see a Tesla. The company needs a website so customers on the island and beyond can browse live inventory, reserve a car with a refundable deposit, and book test drives without calling the showroom.

---

## 1. Introduction

This project is a full stack web application developed for Voltyard Motors, designed to let customers browse, reserve and buy Tesla vehicles and accessories online. It uses HTML, CSS and JavaScript for the frontend, Node.js with Express.js for a RESTful API, and MongoDB through Mongoose for data storage.

The website is an **e-commerce** site. Shoppers can filter the inventory, view a full specification sheet for each car, add cars and accessories to a cart, and place an order. Staff manage listings, orders and customer messages from an admin panel.

## 2. Problem Statement

Voltyard Motors currently faces challenges such as inventory that is only visible to people who visit the showroom, reservations taken by phone and written in a notebook, and the same questions about range and battery condition answered again and again by sales staff. This limits their ability to sell to buyers in the other five towns of Marinduque and on the mainland, prevents two salespeople from promising the same car to different customers, and slows down every sale.

Used EV buyers also have no reliable way to judge battery condition before visiting. A digital solution that publishes the battery test result with each listing, and that locks a car the moment it is reserved, solves both the trust problem and the double-booking problem.

## 3. Objectives

- Develop a responsive website that works on phones, tablets and desktops
- Build a backend REST API with Node.js and Express.js
- Store and retrieve products, users, orders and messages in a MongoDB database
- Let customers register, log in, and see and cancel their own orders
- Prevent double-booking by reserving a car in the database when it is ordered
- Give staff an admin panel to manage inventory, orders and messages
- Prepare the system for online deployment

## 4. Scope

The system will include key pages such as Home, About, Products (Inventory), Product Detail, Cart, Account, Contact and an Admin panel. It will allow users to:

- Browse vehicles and accessories, filtered by model, condition (new, pre-owned, pre-order), price and range, with search, sorting and pagination
- View a specification sheet for each vehicle: range, 0–100 km/h, top speed, battery size, drive, seats, odometer and battery health
- Add vehicles and accessories to a cart and see the deposit due now and the balance due at handover
- Create an account, log in, place an order for showroom pickup in Mogpog or delivery anywhere in Marinduque, and cancel a pending order
- Pre-order the second-generation Roadster with the SpaceX Package, a car that is announced but not yet in production
- Send a test-drive, financing, trade-in or general enquiry through the contact form
- (Admins) View store statistics; add, edit and delete listings; update order status; triage contact messages; and view customers

## 5. Limitations

- No online payment gateway. Orders record the chosen payment method (pay at showroom or bank transfer) and staff confirm by phone.
- No email or SMS notifications for orders or messages.
- No real-time chat.
- One photo per listing. There is no multi-photo gallery or image upload; admins choose an image path that already exists in the project.
- Limited admin controls: a single admin role, no staff permission levels and no audit log.
- Vehicle specifications and prices are sample data for a fictional dealer. Specs for the pre-order Roadster are Tesla's published claims for the prototype.
- Stock reservation uses conditional single-document updates rather than multi-document database transactions.

## 6. Proposed Solution

To address the problem, a web-based system will be developed using modern technologies. This will allow customers to see the live inventory and battery data from anywhere, reserve a car online with a refundable deposit, and contact the showroom through a structured form, while staff manage everything from one admin panel.

At a high level:

1. The browser loads static pages from the `/client` folder.
2. Page scripts call the REST API with `fetch()` (for example `GET /api/products?model=Model%20Y`).
3. The Express server validates the request, reads or writes MongoDB through Mongoose models, and returns JSON.
4. When an order is placed, the server marks each car as `reserved` with a conditional update (`status: 'available'` → `'reserved'`). If another buyer reserved it a moment earlier, the update matches nothing and the order is refused, so a car can never be sold twice. Accessory stock is decremented the same way. If any line fails, everything already held is released.
5. Logged-in users are identified by a JSON Web Token. Admin-only routes check the user's role on the server.

## 7. System Description

**Frontend (what users see).** Plain HTML, CSS and JavaScript ES modules in `/client`, with no build step. A shared module (`ui.js`) renders the header, footer, product cards and toasts. Each page has its own script in `assets/js/pages/`. The cart and login session are kept in `localStorage`. The layout is responsive down to phone width and supports light and dark themes. All photos are free-licence images from Wikimedia Commons, credited on the About page.

**Backend (logic and API).** Node.js with Express.js in `/server/src`, organised as `models → controllers → routes`, with middleware for authentication (`protect`, `adminOnly`, `optionalAuth`) and central error handling. Passwords are hashed with bcrypt. Routes:

| Resource | Endpoints |
|---|---|
| Products | `GET /api/products`, `GET /api/products/:idOrSlug`, `POST`, `PUT /:id`, `DELETE /:id` (admin) |
| Users | `POST /api/users/register`, `POST /api/users/login`, `GET/PUT /api/users/me`, `GET /api/users` (admin) |
| Contact | `POST /api/contact`, `GET /api/contact` (admin), `PATCH/DELETE /api/contact/:id` (admin) |
| Orders | `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/:id`, `PATCH /api/orders/:id/cancel`, `GET /api/orders` (admin), `PATCH /api/orders/:id/status` (admin) |
| Admin | `GET /api/admin/stats` |

**Database (data storage).** MongoDB with four collections defined by Mongoose schemas:

- `products`: vehicles and accessories (name, slug, category, model, condition, price, stock, status, image, image credit, specs, features)
- `users`: name, email, hashed password, phone, role (customer or admin)
- `orders`: reference, user, line items, subtotal, amount due now, balance, fulfilment details, payment method, status
- `contactmessages`: name, email, topic, optional linked vehicle, preferred date, message, status

**Deployment (where it is hosted).** The Express server serves both the API and the `/client` folder, so the whole site deploys as one Node.js web service (for example on Render or Railway) connected to a free MongoDB Atlas cluster. The frontend can also be hosted separately on Vercel or Netlify by setting `window.VOLTYARD_API` to the API's URL and `CLIENT_ORIGIN` on the server.
