# Phase 2: Data Governance and Independent Review

## Server Pagination

Customers, transactions, directory staff, agents, audit logs, and Owner sessions support `page` and `pageSize` query parameters. Page size is constrained to 5-100 records. Existing unpaginated API behavior remains available for controlled exports and aggregate reports.

## Reconciliation

Open **Owner Operations** and run **Financial Reconciliation** before each daily sign-off. A clean result confirms:

- customer lifetime balances equal completed deposit records;
- daily-close counts and totals equal their agent/date deposit records;
- deposits do not reference deleted or missing customers;
- transaction/report totals agree with the deposit ledger.

Any issue must be investigated against the database backup and audit log. The reconciliation endpoint is read-only and never repairs or changes money automatically.

## Session Control

Owner Operations lists active devices without exposing authentication tokens. The Owner can revoke one device session. Password resets and staff removal continue to revoke all sessions for that user.

## Retention Rules

Portal Control configures these guarded ranges:

- audit logs: 365-3650 days (default 2555 / seven years);
- read notifications: 7-365 days (default 90); unread notifications are retained;
- expired verification records: 1-168 hours (default 24);
- expired session records: 1-90 days (default 7).

Cleanup runs opportunistically every six hours and can be run by the Owner from Owner Operations after sensitive reauthentication. Every manual cleanup is audited.

Confirm the bank's legal, regulatory, privacy, and records-management requirements before changing these values. Application retention does not replace PostgreSQL backups or Render recovery retention.

## Independent Security Review

The application cannot independently certify itself. Before processing real money, engage a qualified security reviewer who is separate from the implementation work. The scope should include:

1. authenticated and unauthenticated penetration testing of the Render deployment;
2. role and branch isolation for Owner, Supervisor, and Agent;
3. session, MFA, password reset, rate limiting, and device revocation;
4. deposit concurrency, idempotency, reconciliation, and report integrity;
5. PostgreSQL permissions, backups, restore evidence, secrets, monitoring, and deployment controls;
6. dependency and source-code review;
7. a written report, severity-ranked findings, remediation evidence, and retest sign-off.

Record the reviewer, controlled report reference, completion date, and status in Portal Control. Live readiness remains blocked until the status is **Completed** with all evidence fields populated. Do not upload the confidential report itself to the public application or Git repository.
