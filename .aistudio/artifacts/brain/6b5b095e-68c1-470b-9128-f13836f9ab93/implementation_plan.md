# Server-Verified Payments, Webhook Security & Automated Reconciliation

An end-to-end payment security, webhook validation, and automated financial reconciliation architecture for WashWise. Enforces strict HMAC-SHA256 webhook signature verification with replay protection, server-authoritative payment verification, atomic cancellation & refund workflows, background ledger reconciliation, and strict PCI-DSS zero raw card storage compliance.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following operational policies have been confirmed through initial clarification:

- **Confirmed Decision 1 (Webhook Authentication)**: Webhook endpoints enforce cryptographic **HMAC-SHA256 signature verification** against a shared webhook secret, paired with timestamp skew validation ($\le 300\text{s}$) and nonce cache deduplication to eliminate replay attacks.
- **Confirmed Decision 2 (Cancellations & Refunds)**: Order cancellations prior to wash initiation automatically issue a **full refund** to the original payment source (or immediate wallet credits for wallet/UPI/cash reservations), while atomically freeing the reserved machine slot in Firestore.
- **Confirmed Decision 3 (Payment Reconciliation)**: An automated background reconciliation engine continuously compares internal payment records with simulated/actual provider settlement data, immediately flagging discrepancies (amount mismatches, orphaned charges, or missing captures) in an administrative audit center.
- **PCI-DSS Compliance Mandate**: Zero PAN (Primary Account Number), CVV, or raw cardholder information is ever stored, accepted, or logged by the server. All payments rely exclusively on provider-issued transaction references and tokenized IDs.

---

## 1. Overview & Core Concept

- **What It Does**: Secures the complete payment lifecycle in WashWise—from server-authoritative checkout verification to cryptographically validated webhook updates, instantaneous user cancellations with automated refunds, and continuous background ledger reconciliation.
- **Target Audience**: 
  - Students & Customers: Frictionless checkout with instant confirmation, secure refunds on cancellation, and zero fear of duplicate charges.
  - Store Managers & Super Admins: Uncompromised visibility over payment states (`pending`, `successful`, `failed`, `refunded`), automatic webhook verification, and instant discrepancy alerts during reconciliation.
- **Key Value**: Protects store revenue from chargebacks and orphaned bookings, guarantees atomic machine slot recovery upon cancellation, prevents double charges via transaction-level idempotency, and guarantees full PCI-DSS compliance.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Server-Verified Checkout & Status Handling**:
   - Customer chooses payment method (Wallet, Card/Online, NetBanking, Pay at Store/COD, or Subscription Credits).
   - Checkout locks the CTA with a loading spinner while `authFetch` passes a unique `idempotencyKey` and authorization token to `/api/payments/process-booking`.
   - The server verifies pricing against Firestore settings, creates an authoritative payment record with status `successful` (or `pending` for asynchronous online flows), and locks the machine slot inside an atomic `runTransaction`.
   - If payment fails, a clear inline alert explains the reason (e.g. "Card declined by bank", "Insufficient wallet balance") without clearing the form, allowing one-click retry.

2. **Customer Order Cancellation & Automated Refund**:
   - In `Orders.tsx` (Past & Active Orders) or the Order Details modal, active bookings whose wash has not yet started show an accessible **"Cancel & Refund"** action.
   - Clicking triggers a confirmation modal detailing the exact refund breakdown:
     - Wallet payments $\to$ instantly refunded back to customer wallet balance.
     - Online / Card payments $\to$ refunded to original payment source with gateway refund reference ID.
     - Subscription credits $\to$ plan credits atomically refunded to the user's quota.
     - Reserved machine slot is instantly restored to "available" status for other students.
   - Real-time status badge transitions to `Cancelled (Refunded)`.

3. **Payment Reconciliation & Webhook Audit Center (Super Admin & Store Manager)**:
   - Dedicated **"Payment & Reconciliation"** audit panel within the Super Admin console.
   - Displays real-time settlement metrics: Total Volume, Settled Volume, Refunded Volume, Pending Captures, and Discrepancy Alerts.
   - **Reconciliation Data Grid**: Dense tabular view with `font-mono tabular-nums` matching internal transaction records against provider settlement logs.
   - **Interactive Webhook Simulator**: Built-in developer/admin diagnostic tool allowing admins to simulate legitimate and tampered webhooks (e.g., valid signature vs. forged HMAC signature, replay attack test) to verify live defense mechanisms.

### Visual Identity & Theme (SaaS Dashboard Constitution)

- **Surfaces**: Clean White / Slate Dark `#0F172A` with single-elevation depth and 1px dividers (`border-slate-200 dark:border-slate-800`).
- **Typography**: `Plus Jakarta Sans` for headers and action buttons; strictly enforced `font-mono tabular-nums` for transaction IDs, amounts, and audit timestamps.
- **Semantic Badges**:
  - `Successful`: Emerald `#16A34A` / `bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300`
  - `Pending`: Amber `#D97706` / `bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300`
  - `Failed`: Crimson `#DC2626` / `bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300`
  - `Refunded`: Purple `#9333EA` / `bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300`
- **Zero Raw Card Storage Notice**: Prominent security stamp displaying `256-Bit SSL Encrypted • Tokenized Gateway • Zero Raw Card Storage (PCI-DSS Level 1 Compliant)`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: HMAC-SHA256 Webhook Verification vs. Simple Secret Header**
  - *Chosen Approach*: Compute `crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex')` and verify against the `x-webhook-signature` header, rejecting any payload whose timestamp deviates by $> 300\text{s}$ or whose event ID has already been processed.
  - *Why*: Header tokens can be intercepted or replayed by malicious actors. HMAC signature over the exact payload and timestamp guarantees message authenticity, tamper-proofing, and replay prevention.
  - *Alternatives Considered*: IP allowlisting alone (fragile in cloud/containerized environments with dynamic ingress IPs).

- **Decision 2: Automated Full Refund vs. Manual Review Queue**
  - *Chosen Approach*: Automated instant refund for cancellations initiated prior to the washing cycle start (`status` in `['paid', 'pending']`), while blocking automated cancellations once laundry is `In Wash`, `In Dryer`, or `Ready`.
  - *Why*: Eliminates customer support friction and chargeback disputes for students who reschedule or cancel in advance, while protecting store operators from washing clothes for cancelled bookings.
  - *Alternatives Considered*: Manual admin review for all cancellations (causes delays and frustration for students needing quick slot swaps).

- **Decision 3: Automated Background Reconciliation vs. Manual Export-Import**
  - *Chosen Approach*: Automated periodic reconciliation engine that compares Firestore `payments` records with provider transactions, classifying them as `MATCHED`, `AMOUNT_MISMATCH`, `ORPHAN_PROVIDER_PAYMENT`, or `MISSING_CAPTURE`.
  - *Why*: Catches edge cases (e.g. user network drops after provider payment succeeded before our redirect) without requiring manual spreadsheet matching.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                          WashWise Client UI                            │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Billing / Checkout   │  │ Orders & Details │  │ Admin Payment    │  │
│  │ (Idempotent Submit)  │  │ (Cancel & Refund)│  │ & Reconcile Hub │  │
│  └───────────┬──────────┘  └────────┬─────────┘  └─────────┬────────┘  │
└──────────────┼──────────────────────┼──────────────────────┼───────────┘
               │                      │                      │
               ▼                      ▼                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        WashWise Express Backend                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. POST /api/payments/process-booking (Server-verified checkout) │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 2. POST /api/payments/webhook (HMAC-SHA256 signature + replay)   │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 3. POST /api/payments/cancel-and-refund (Atomic cancellation)    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 4. POST /api/payments/reconcile (Automated background auditing)  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 5. POST /api/admin/payments/simulate-webhook (Diagnostic sandbox)│  │
│  └───────────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Firestore Collections                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ payments     │  │ refunds      │  │ idempotency  │  │ reconcile  │  │
│  │ (Audit trail)│  │ (Audit log)  │  │ _keys        │  │ _reports   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema Updates

1. **`payments` Collection**:
   - `id`: Unique Payment Document ID (e.g. `pay_rec_xyz`)
   - `paymentId`: Provider / Internal Transaction ID (`TXN_...`)
   - `bookingId`: Linked Booking reference ID
   - `userId`: Customer UID
   - `amount`: Number (INR ₹)
   - `status`: `'pending' | 'successful' | 'failed' | 'refunded'`
   - `paymentMethod`: `'wallet' | 'card' | 'netbanking' | 'pay_at_store' | 'subscription_credits'`
   - `providerTxnId`: External gateway transaction reference
   - `idempotencyKey`: Unique deduplication key
   - `cardLast4` / `cardBrand`: Sanitized token metadata (NEVER raw card numbers or CVV)
   - `reconciled`: Boolean
   - `reconciledAt`: ISO timestamp
   - `createdAt`: ISO timestamp

2. **`refunds` Collection**:
   - `id`: Refund Document ID (`ref_xyz`)
   - `paymentId`: Original payment reference
   - `bookingId`: Linked booking ID
   - `userId`: Recipient UID
   - `amount`: Refunded amount in ₹
   - `reason`: Cancellation reason
   - `status`: `'processed' | 'failed'`
   - `refundMethod`: `'wallet' | 'original_source' | 'credits'`
   - `createdAt`: ISO timestamp

3. **`reconciliation_reports` Collection**:
   - `id`: Report ID
   - `periodStart` / `periodEnd`: Time horizon
   - `totalTransactions`: Total checked
   - `matchedCount`: Matched count
   - `mismatchCount`: Discrepancy count
   - `discrepancies`: Array of discrepancy items with error type and resolution advice
   - `generatedAt`: ISO timestamp

---

## 5. Implementation Checklist

- [x] **Data Model & Rules Hardening**:
  - Update `firebase-blueprint.json` with `PaymentRecord`, `RefundRecord`, and `ReconciliationReport` entities.
  - Update `src/types.ts` with TypeScript interfaces for payments, refunds, webhooks, and reconciliation.
  - Harden `firestore.rules` for `/payments`, `/refunds`, and `/reconciliation_reports` allowing user read on own payments and admin read/write.
- [x] **Server Payment Verification & Webhook Engine (`server.ts`)**:
  - Implement `/api/payments/webhook` with HMAC-SHA256 signature verification, 5-minute replay window tolerance, and event deduplication.
  - Support webhook events: `payment.successful`, `payment.failed`, `payment.refunded`.
  - Ensure zero raw card details are logged or stored anywhere in request handlers or database operations.
- [x] **Automated Cancellation & Refund Workflow (`server.ts`)**:
  - Implement `/api/payments/cancel-and-refund` with Firestore atomic `runTransaction`:
    - Validates booking status is eligible for cancellation (`pending` or `paid`).
    - Issues instant wallet credit refund or gateway refund reference.
    - Atomically releases the reserved machine slot in `/slots/{date}_{timeSlot}`.
    - Updates booking status to `cancelled` and records a document in `/refunds`.
- [x] **Background Reconciliation Engine (`server.ts`)**:
  - Implement `/api/payments/reconcile` automated reconciliation route comparing internal payments with provider ledgers.
  - Implement `/api/admin/payments/overview` and `/api/admin/payments/simulate-webhook` for testbed diagnosis.
- [x] **Frontend Customer Cancellation & Refund UX (`src/pages/Orders.tsx`)**:
  - Add interactive "Cancel Booking & Refund" button for upcoming/eligible active bookings.
  - Display cancellation confirmation modal with refund source breakdown.
  - Update order receipt with payment verification badge and refund audit trail.
- [x] **Frontend Administrative Reconciliation Center (`src/components/admin/PaymentReconciliationCenter.tsx`)**:
  - Build dashboard tab in `SuperAdminDashboard.tsx` displaying settlement stats, discrepancy alerts, and manual reconciliation run button.
  - Add interactive Webhook Testing Sandbox with test payloads and HMAC signature generator.
- [x] **Verification & Build Validation**:
  - Validate with `lint_applet` and `compile_applet`.
