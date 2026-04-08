# FoodNest

FoodNest is a role-based meal ordering platform with three working user roles:

- Hosteller
- Home Cook
- Delivery Agent

The project currently uses:

- `FrontEnd/` for the UI
- `backend/` for the Node.js and Oracle backend
- Oracle XE for local database development

**Current Flow**

1. Users sign up with role-based details.
2. Hostellers start with `1000` wallet balance.
3. Home cooks start with `0`.
4. Delivery agents start with `0`.
5. A hosteller places an order from the meal dashboard.
6. The home cook moves the order through `Preparing` and `Prepared`.
7. A delivery agent accepts the prepared order.
8. The delivery agent moves it through `Out for Delivery` and `Delivered`.
9. The hosteller can submit a review and rating after delivery.

**Run Locally**

1. Open a terminal in [`backend`](c:\Users\Parth\OneDrive\Dokumen\Desktop\food\FoodNest-main\backend)
2. Fill [`backend/.env`](c:\Users\Parth\OneDrive\Dokumen\Desktop\food\FoodNest-main\backend\.env)
3. Start the backend:

```powershell
node index.js
```

4. Open:

```text
http://localhost:3000
```

**Environment Variables**

Use [`backend/.env.example`](c:\Users\Parth\OneDrive\Dokumen\Desktop\food\FoodNest-main\backend\.env.example) as the template:

```env
DB_USER=your_oracle_username
DB_PASSWORD=your_oracle_password
DB_CONNECTION_STRING=localhost:1521/XE
```

**Deployment Prep**

The backend is already structured so it can be deployed as a single Node web service that serves the frontend too.

What still matters for deployment:

- a reachable Oracle database
- production Oracle credentials
- a host that supports the Node backend process
