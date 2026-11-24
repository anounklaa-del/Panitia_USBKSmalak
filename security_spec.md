# Security Specification & Payload-First TDD (`firestore.rules`)

## 1. Data Invariants
1. **Global Safety Net**: Every unspecified Firestore collection path (`match /{document=**}`) is denied for read and write.
2. **Split Credential vs Directory Collections**: Password hashes and salts reside strictly in `/pas_accounts/{usernameKey}` with `allow list: if false;` so account enumeration via collection listing is blocked. Non-sensitive display metadata lives in `/pas_account_directory/{usernameKey}`.
3. **Immutable Built-In Admin**: The primary `admin` account (`/pas_accounts/admin`) cannot be overwritten via `create`, cannot be deactivated (`active == true`), cannot be demoted (`role == 'admin'`), and cannot be deleted.
4. **Strict Dataset Allowlist**: `/pas_datasets/{datasetId}` accepts only the 9 valid dataset IDs (`students`, `committee`, `schedules`, `proctors`, `proctor_matrix`, `berita_acara_overrides`, `room_allocations`, `rules_bell`, `settings_configs`), and `allow list: if false;` blocks blanket scraping.
5. **Strict Schema & Server Timestamps**: Every document enforces exact `hasAll` + `hasOnly` key allowlists, string lengths, hex patterns on cryptographic fields, bounded arrays (`<= 2000`), immutable `createdAt`, and `request.time` server timestamps.
6. **Master Account Gate**: Dataset creation and updates require `/pas_accounts/admin` to exist (`exists(...)`), preventing orphaned writes before initialization.

## 2. Adversarial "Dirty Dozen" Payloads
1. Unspecified collection read/write (`/secret_collection/doc`) -> `PERMISSION_DENIED`.
2. Listing `/pas_accounts` to enumerate password hashes -> `PERMISSION_DENIED`.
3. Re-creating `/pas_accounts/admin` when it already exists -> `PERMISSION_DENIED`.
4. Deactivating or demoting `/pas_accounts/admin` (`active: false` or `role: 'panitia'`) -> `PERMISSION_DENIED`.
5. Deleting built-in `admin` or `panitia` accounts -> `PERMISSION_DENIED`.
6. Creating `/pas_accounts/custom_user` with `role: 'admin'` -> `PERMISSION_DENIED`.
7. Shadow update injecting `ghostField: true` into `/pas_datasets/students` -> `PERMISSION_DENIED`.
8. Client-forged `createdAt` or `updatedAt` timestamp not equal to `request.time` -> `PERMISSION_DENIED`.
9. Invalid `datasetId` outside allowlist (`/pas_datasets/unknown`) -> `PERMISSION_DENIED`.
10. Oversized username/ID poisoning (`> 64` or `> 128` chars) -> `PERMISSION_DENIED`.
11. Listing `/pas_datasets` collection -> `PERMISSION_DENIED`.
12. Creating `/pas_accounts` record with invalid non-hex `saltHex` or `hashHex` -> `PERMISSION_DENIED`.
