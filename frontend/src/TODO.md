# Order Flow State Machine Implementation TODO

- [x] 1. Backend model updates (`backend/marketplace/models.py`)
  - [ ] Add `ORDER_PLACED` status
  - [ ] Remove `PENDING` from state machine flow usage
  - [ ] Enforce strict transitions: `ORDER_PLACED -> CONFIRMED -> PAID -> DELIVERED -> COMPLETED`
  - [ ] Keep `DISPUTED` as terminal override from `DELIVERED`
  - [ ] Set default order status to `ORDER_PLACED`

- [ ] 2. Backend serializer updates (`backend/marketplace/serializers.py`)
  - [ ] Expand `OrderSerializer` with escrow/payment/dispute fields
  - [ ] Keep backend as single source-of-truth for status mutation

- [ ] 3. Backend view/action updates (`backend/marketplace/views.py`)
  - [ ] Replace old `update_order_status` logic with strict transition-safe logic
  - [ ] Add seller action: confirm order
  - [ ] Add buyer action: pay (MPESA reference + escrow lock)
  - [ ] Add seller action: mark delivered
  - [ ] Add buyer action: confirm delivery (release escrow)
  - [ ] Add buyer action: open dispute (freeze escrow + metadata)
  - [ ] Ensure idempotent behavior for repeated requests

- [ ] 4. Backend route updates (`backend/marketplace/urls.py`)
  - [ ] Wire new action endpoints without breaking existing structure

- [ ] 5. Buyer dashboard refactor (`frontend/src/Dashboard.js`)
  - [ ] Replace localStorage orders/disputes with API-driven data
  - [ ] Render actions strictly from `order.status`
  - [ ] Implement MPESA modal flow for `CONFIRMED -> PAID`
  - [ ] Implement dispute modal submission to backend
  - [ ] Implement confirm-delivery action
  - [ ] Add polling (every ~3 seconds) + cleanup

- [ ] 6. Seller dashboard refactor (`frontend/src/SellerAccount.js`)
  - [ ] Replace dropdown/manual status control with state-driven buttons
  - [ ] `ORDER_PLACED`: show **Mark Confirmed**
  - [ ] `CONFIRMED`: show **Waiting for payment**
  - [ ] `PAID`: show **Mark as Delivered**
  - [ ] `DELIVERED/COMPLETED/DISPUTED`: read-only
  - [ ] Add polling (every ~3 seconds) + cleanup
  - [ ] Apply strict badge color mapping by status

- [ ] 7. Migrations and verification
  - [ ] Run Django migrations for model/state updates
  - [ ] Run backend checks
  - [ ] Run frontend build/test sanity check
