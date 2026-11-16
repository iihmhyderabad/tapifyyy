# Dynamic QR Manager — Task Roadmap

## Extra user requests
- [x] Add PDF, CorelDRAW/SVG, layered PSD and high-quality PNG export controls to both print areas; verified all four downloads, 4-inch PDF, 8192-pixel PNG, 2400-pixel/600-PPI PSD with three layers, QR decoding and mobile layout. Artwork and records unchanged; native CorelDRAW/Photoshop opening not tested.
- [x] Apply uploaded NEW_NFC master artwork to every card collection; verified legacy and both separate collections, mobile display, editable SVG download and 8192×8192 PNG download; QR values and records unchanged.
- [x] Enlarge only the existing print card scan code; add editable SVG and 8192×8192 PNG exports. Verified both downloads, mobile layout, vector rendering, 8K dimensions and QR decoding; original raster illustration remains embedded, native CorelDRAW import not tested.
- [x] Add separate Card Designs module: Google Review + Instagram, 10 unique dynamic QR cards each, isolated lists, editing and separate 4×6 printing/downloads; verified editing, redirects, blank activation, PNG/ZIP exports, mobile artwork and printing; existing records untouched.
- [x] Direct public QR activation: blank scans show a mobile form, save the destination once, then redirect future scans; preserve dashboard, print design and existing database. Verified mobile activation, repeat scans, overwrite prevention and invalid URL rejection; test card restored.
- [x] Admin login = sunnykumargupta221@gmail.com / sunny3456@Sk (replaced placeholder admin@greview.local)
- [x] Show/hide password toggle on password fields
- [x] Remove login authentication — open dashboard, no sign-in gate (user request 2026-11-01)
- [x] Connect to live backend data (public.qr_records), Add + bulk generation with unique GREV IDs, verified end-to-end (user request 2026-11-02)
- [x] Restore secure role-based auth (user request 2026-11-03): /auth sign-in gate, Main Admin (super_admin) = sunnykumargupta221@gmail.com, User Management page, per-user permissions (create / edit / activate-deactivate), public signup disabled, logout, change-password, RLS locked to signed-in staff. Old GREV-001–010 preserved.

Source spec: uploaded brief (Dynamic QR Management Dashboard for Google Review NFC Cards).
Reference card design: uploaded WhatsApp image (preserved as-is; only QR area + number replaced).

## Phase 1 — Database, auth, redirect (done)
- [x] `qr_records` table, GRANTs, RLS
- [x] `user_roles` + `has_role()` security-definer; roles now admin / super_admin / user
- [x] Seed 10 rows GREV-001 … GREV-010 (destination_url NULL = awaiting)
- [x] `record_scan(qr_code)` RPC
- [x] Email auth enabled; admin account + super_admin role
- [x] Public redirect route `/r/:qrCode` (302, branded states, scan counter)
- [x] `user_permissions` table + `has_permission()`; qr_records anon writes removed, permission-based RLS

## Phase 2 — Admin dashboard (done)
- [x] /auth sign-in (no signup), /_authenticated gate, session-aware header
- [x] Stats, table, search + status filter
- [x] Edit dialog, enable/disable with confirmation
- [x] QR preview, PNG + SVG download, copy permanent URL
- [x] Scan count + last scanned
- [x] Premium white/black/gold design system

## Phase 3 — Print previews (done)
- [x] /print: ten 4×4 in card previews matching reference image
- [x] Genuine per-card QR, unique number, PNG export + print-all

## Phase 4 — Role-based access (done)
- [x] User Management page (/users, Main Admin only): create, edit permissions, reset password, remove
- [x] Permission gating in dashboard (Add / Edit / Disable-Enable)
- [x] Logout with cache teardown; change-own-password dialog
- [x] Signup disabled, no anonymous writes

## Extra user requests
- [x] "Remove login authentication" again (2026-11-05, user confirmed "Remove the gate"): sign-in page, user-management page and auth gating removed; anonymous QR writes re-opened; auth tables and Main Admin account kept unused in the database for possible future re-enable.

## Rules (from spec)
- No fake QR patterns, no in-memory storage, redirects must be tested before claiming working
- Destinations changeable later without changing printed QRs
- Main Admin full access; additional users get permissions assigned by the Main Admin
- URL validation http/https; confirm before disable
