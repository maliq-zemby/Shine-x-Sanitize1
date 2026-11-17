# Security Specification — Shine-x-Sanitize Alp Group

## 1. Data Invariants
1. A user cannot self-assign `role: "admin"` or `accountStatus: "active"` when registering as a `manager` (company registration starts as `pending`).
2. Banned accounts (`accountStatus == "banned"`) are denied all writes across collections.
3. Only active `admin` accounts (or bootstrapped verified admin email `maliqzemby@gmail.com`) can approve/reject companies, ban/unban users, or approve/reject promotional announcements.
4. Only active `manager` or `admin` accounts can modify `/services/{serviceId}` base prices.
5. Clients can create bookings owned by `request.auth.uid`, toggle their own `clientGpsActive` + `clientCoords`, accept counter-offers, and submit reviews.
6. Active `agent` accounts can toggle `gpsActive`, update `agentGps`, and record start/end placement timestamps and photos, without modifying `finalPrice`.
7. Promotions visible to clients (`status == "approved"`) are readable publicly/authenticated; `pending` or `rejected` promotions are readable only by their creator or Admin.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Client creates `/users/{uid}` with `role: "admin"`.
2. Manager self-updates `/users/{uid}` to set `accountStatus: "active"` while `"pending"`.
3. Client updates `/services/srv-1` `basePrice` to `1`.
4. Client updates `/bookings/{id}` `status` directly to `"completed"` or modifies `assignedAgents`.
5. Agent updates `/bookings/{id}` `finalPrice` to `500000`.
6. Unauthenticated user writes to `/bookings/{id}`.
7. Banned user creates a booking or updates a profile.
8. Non-owner client reads another user's private `/users/{otherUid}` document.
9. Manager creates `/promotions/{id}` directly with `status: "approved"`.
10. Client injects an extra shadow field `isAdminBypass: true` into `/bookings/{id}`.
11. User passes a 2000-char string into `booking.id` or `userId`.
12. User with `email_verified == false` attempts admin operations.
