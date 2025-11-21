# Fogon-Inventory-Management-System

Full-stack of our inventory management system for a food truck / restaurant.

- **Backend:** Flask + SQLAlchemy (Python)
- **Mobile app:** Expo / React Native
- **Platforms we use:** iOS Simulator + real phones (Android/iOS) 

---

## 1. Tech Stack & Versions

Project is currently developed with:

- **Git:** 2.50.1
- **Python:** 3.13.2  _(any **3.10+** is OK)_
- **Node.js:** 20.19.5  _(Node **18+** recommended)_
- **npm:** 10.8.2
- **Expo CLI (via npx):** 54.0.16

Teammates don’t need the *exact* same versions, but should be close to:

- Python **3.10 – 3.13**
- Node **18 – 22**
- Expo **SDK 54.x**

---

## 2. Features (Sprint 1 & 2)

**Authentication & Roles**

- Login/logout with JWT
- Role-based access:
  - **Manager**
    - Full control of inventory (add / edit / delete products)
    - See **low-stock badges** in inventory
    - View all stock requests
    - **Approve / deny** stock requests
    - Receive low-stock + request notifications
  - **Cook**
    - View inventory
    - Create **stock requests** for items that are low or out of stock
    - **Edit / delete** their own pending requests
    - Receive notifications when requests are approved or denied

**Products**

- Product CRUD (name, quantity, price, description)
- Reorder threshold + “Low stock” label
- Optional product image upload (stored under `static/uploads/`)

**Stock Requests**

- Cooks create requests from the product list
- Managers approve/deny requests from “Stock Requests” screen
- Approving increases product quantity
- Denying optionally includes a reason

**Notifications**

- **LOW_STOCK** notifications for managers
- **REQUEST_APPROVED / REQUEST_DENIED** notifications for cooks
- Low-stock notifications are de-duplicated so the manager doesn’t see 100 cards for the same product

**Mobile UX**

- Expo Router navigation
- Screens: Login, Register, Inventory, Add Product, Edit Product, Stock Requests (manager + cook views), Notifications
- Styled with a consistent Fogon orange theme and cards

---

## 3. Project Structure

```text
Fogon-Inventory-Management-System/
├─ app.py                  # Flask app entrypoint (backend API)
├─ models.py               # SQLAlchemy models (User, Product, StockRequest, Notification, ...)
├─ config.py               # Flask config helper
├─ config/api.js           # (legacy web API config – kept for reference)
├─ requirements.txt        # Python dependencies
├─ .env                    # Environment variables (DB URL, SECRET_KEY, JWT_SECRET_KEY)
├─ static/
│  └─ uploads/             # Uploaded product images
├─ templates/              # (optional) HTML templates for legacy web views

├─ auth/                   # Flask auth blueprints (if used)
├─ inventory/              # Flask inventory blueprint
├─ requests/               # Flask stock-requests blueprint
├─ screens/                # Legacy React Native screens (kept for history)

├─ FogonIMSMobile/         # Expo app (React Native)
│  ├─ app/                 # Expo Router screens
│  │  ├─ _layout.tsx
│  │  ├─ login.tsx
│  │  ├─ register.tsx
│  │  ├─ inventory.tsx
│  │  ├─ addProduct.tsx
│  │  ├─ editProduct.tsx
│  │  ├─ requests.tsx
│  │  ├─ request.tsx
│  │  └─ notifications.tsx
│  ├─ src/api/client.ts    # Axios client (handles JWT + base URLs)
│  ├─ assets/              # App icons, splash images
│  ├─ package.json         # JS dependencies
│  ├─ tsconfig.json        # TypeScript config
│  ├─ app.json             # Expo app config
│  └─ babel.config.js      # Babel config

└─ README.md               # This file
