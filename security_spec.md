# Security Specification — Shine-x-Sanitize Alp Group

## 1. Data Invariants
1. A user cannot self-assign `role: "admin"` or `status: "approved"` / `accountStatus: "active"` when registering as a `manager` (company registration starts as `status: "pending"`, `rejectionReason: ""`).
2. Banned accounts (`accountStatus == "banned"` or `status == "banned"`) are denied all writes across collections. Unapproved company accounts (`role == "manager"` and `status != "approved"`) are strictly denied access to company operations (`/services`, `/bookings`, `/promotions`, manager notifications).
3. Only active `admin` accounts (or bootstrapped admin identity) can approve/reject companies (setting `status: "approved"` or `status: "rejected"` + `rejectionReason`), ban/unban users, or approve/reject promotional announcements.
4. Only approved `manager` (`status == "approved"`) or `admin` accounts can modify `/services/{serviceId}` base prices.
5. Clients (`status == "approved"`) can create bookings owned by `request.auth.uid`, toggle their own `clientGpsActive` + `clientCoords`, accept counter-offers, and submit reviews.
6. Active `agent` accounts can toggle `gpsActive`, update `agentGps`, and record start/end placement timestamps and photos, without modifying `finalPrice`.
7. Promotions visible to clients (`status == "active"` or `status == "approved"`) are readable publicly/authenticated; approved `manager` accounts can publish active promotions immediately and edit/delete only promotions where `createdByUid == request.auth.uid`.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Client creates `/users/{uid}` with `role: "admin"`.
2. Pending or rejected manager self-updates `/users/{uid}` to set `status: "approved"` or `accountStatus: "active"`.
3. Client updates `/services/srv-1` `basePrice` to `1`.
4. Unapproved manager (`status != "approved"`) modifies `/services`, updates `/bookings`, or creates/edits/deletes `/promotions`.
5. Client updates `/bookings/{id}` `status` directly to `"completed"` or modifies `assignedAgents`.
6. Agent updates `/bookings/{id}` `finalPrice` to `500000`.
7. Unauthenticated user writes to `/bookings/{id}` or `/promotions/{id}`.
8. Banned user creates a booking or updates a profile.
9. Non-owner client reads another user's private `/users/{otherUid}` document.
10. Manager A updates or deletes a promotion created by Manager B (`createdByUid != request.auth.uid`).
11. Client injects an extra shadow field `isAdminBypass: true` into `/bookings/{id}` or `/promotions/{id}`.
12. User passes a 2000-char string into `booking.id`, `promo.id`, or `userId`.
