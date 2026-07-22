# Phase 3: Users and Roles

## Role-Specific Account Creation

The portal intentionally has no generic **Add User** action.

- Supervisors and the Owner create agents with **Add Agent** in Agent Management.
- Only the Owner creates supervisors with **Add Supervisor** in Supervisor Management.
- Account Status is monitoring-only and does not create accounts.

This separation preserves server-side role and branch rules and avoids ambiguous privileges.

## Account Status

The Owner-only Account Status screen reports:

- **Active**: enabled and ready to authenticate;
- **Locked**: currently blocked by the login-attempt rate limiter;
- **First Login Pending**: an agent must complete phone/token verification and set permanent credentials;
- **Password Reset Required**: a supervisor or Owner issued temporary replacement credentials;
- **Archived**: removed from active operation and unable to authenticate;
- **Inactive**: disabled without being archived.

The screen also shows branch, role, test-data marking, active-session count, and links to the correct role-specific management page. It never exposes password hashes, temporary passwords, setup tokens, session tokens, or verification codes.

## Live Mode

Test staff and test customers must be removed before Live Mode. This rule is enforced by the backend, not only by the Portal Control interface. Use Portal Control to remove test data, run reconciliation, export a backup, and verify production readiness before switching modes.
