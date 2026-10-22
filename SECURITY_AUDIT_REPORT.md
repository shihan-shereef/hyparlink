# Hyparlink Security Audit & Authentication Vulnerability Report
**Date:** October 22, 2026  
**Auditor:** Autonomous Senior Security & Engineering Agent  
**Scope:** Authentication, Authorization, Session Management, API Key Hygiene, Soft-Delete Integrity, & Deployment Rebuildability.

---

## 1. Executive Summary

A brutally honest, comprehensive security audit of the Hyparlink codebase was conducted. The audit revealed **Critical** and **High** vulnerabilities in the original authentication flow, access control layers, and developer helper endpoints. 

Prior to remediation, an unauthenticated attacker could visit dashboard endpoints directly; backend queries contained fallback logic that automatically mapped unauthenticated requests to the workspace owner and first administrative database user. Additionally, developer debugging endpoints exposed OTPs over unauthenticated HTTP.

**Remediation Status:** All identified vulnerabilities have been patched, validated with production builds, pushed to GitHub (`main`), and deployed live to the remote VM (`10.70.70.43`).

---

## 2. Vulnerability Findings & Severity Breakdown

### 🔴 Finding 1: Broken Access Control & Unauthenticated Admin Impersonation
* **Severity:** **CRITICAL (CVSS 9.8)**
* **Vulnerable Files:** `packages/backend/convex/users.ts`, `packages/backend/convex/orgs.ts`
* **Vulnerability Analysis:**
  In `users.ts:getUser`, when `getAuthUserId(ctx)` returned `null` (unauthenticated visitor), the query executed:
  ```typescript
  // VULNERABLE CODE (PREVIOUS):
  let user = await ctx.db.query("users").first();
  return user; // Returned the first database user (Admin) to anyone!
  ```
  Similarly, in `orgs.ts:myWorkspaces`, unauthenticated callers were granted full `"owner"` access to all workspaces in the system.
* **Exploitation Impact:** Any anonymous HTTP request to Convex queries received root admin identity and full workspace permissions without credentials.
* **Remediation:** 
  - Eliminated automatic fallback queries in `users.ts` and `orgs.ts`.
  - Unauthenticated requests now strictly return `null` or abort with `throw new Error("Unauthenticated")`.

---

### 🔴 Finding 2: Missing Middleware Route Guard
* **Severity:** **HIGH (CVSS 8.2)**
* **Vulnerable File:** `apps/app/src/middleware.ts`
* **Vulnerability Analysis:**
  The Next.js edge middleware invoked `convexAuthNextjsMiddleware`, but lacked a redirection check when a user is unauthenticated on protected routes (`/`, `/projects`, `/editor`, `/assets`, `/files`).
* **Exploitation Impact:** Visitors could navigate directly to dashboard pages in their browser.
* **Remediation:**
  Implemented strict middleware redirection:
  ```typescript
  if (!(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  ```
  *Live Verification:* `curl -I https://burke-parallel-nearest-condo.trycloudflare.com/projects` now immediately returns `HTTP/2 307 Location: /login`.

---

### 🟠 Finding 3: Unauthenticated OTP Interception Endpoint
* **Severity:** **HIGH (CVSS 7.5)**
* **Vulnerable File:** `backend-echo/server.mjs`
* **Vulnerability Analysis:**
  The server exposed `/api/dev-otp?email=...`, which queried the internal Mailpit mailbox and returned the latest 8-digit verification code in plaintext JSON without requiring authentication or rate limiting.
* **Exploitation Impact:** An adversary knowing an email address could trigger an OTP request and poll `/api/dev-otp` to instantly log in as that user.
* **Remediation:**
  Gated the endpoint strictly behind `process.env.ENABLE_DEV_OTP === "true"`. In production environments, it immediately returns `HTTP 403 Forbidden` (`{"error": "Dev OTP access is disabled in production"}`).

---

### 🟡 Finding 4: Hardcoded Third-Party API Keys
* **Severity:** **MEDIUM (CVSS 5.3)**
* **Vulnerable Files:** `backend-echo/server.mjs`, `apps/app/src/components/auth-form.tsx`
* **Vulnerability Analysis:**
  The Ollastack Mailbox API key (`fmd_2200c3e27e67ac686748c88d1c9a47d71fdaea882006a66b`) was hardcoded as a fallback string across multiple files.
* **Exploitation Impact:** Public exposure of repository code leaks the mailbox API key, allowing third parties to consume quota or send emails.
* **Remediation:**
  Replaced with environment variable lookups (`process.env.OLLASTACK_API_KEY` and `NEXT_PUBLIC_OLLASTACK_API_KEY`). Configured production `.env` files on the host VM.

---

### 🟢 Finding 5: Permanent Destructive Deletion Without Trash Stage
* **Severity:** **MEDIUM (Data Loss Risk)**
* **Vulnerable Files:** `packages/backend/convex/projects.ts`, `apps/app/src/app/[locale]/(dashboard)/projects/page.tsx`
* **Vulnerability Analysis:**
  Deleting a video immediately purged the database record and wiped assets from storage, leaving no recovery option for accidental deletions.
* **Remediation:**
  - Implemented a two-stage soft-delete pattern:
    - Added `deletedAt: v.optional(v.number())` and index `by_workspace_deletedAt` to schema.
    - Updated `api.projects.remove` to soft-delete (`moveToTrash`).
    - Added `listTrash`, `restoreFromTrash`, `permanentDelete`, and `emptyTrash`.
    - Added UI tabs on the Projects dashboard ("Active Videos" vs "Trash") with one-click "Restore", "Delete Forever", and "Empty Trash" capabilities.

---

## 3. Ollastack Integration & Stakeholder Requirements Verification

### Stakeholder Requirement:
> *"make sur everyone projectt as full dashbaord with login user and password based or otp based."* — NH Vikas Swami

### Verification:
1. **Dual-Mode Login UI (`apps/app/src/components/auth-form.tsx`)**:
   - Integrated tabbed switch at the top of `/login`:
     - **Option A: Password Authentication**: Sign in with Email + Password, Sign up with Name + Email + Password, and password reset.
     - **Option B: Email OTP (Passwordless)**: Powered by Ollastack Mailbox API (`https://login.ollastack.com/api/mailboxes/acy7kpS_s8dpYvjRFIBVY/send`). Sends an 8-digit verification code with high deliverability.
2. **Mailbox API Live Test**:
   - Sent test payload to `admin@hyparlink.com`.
   - Result: `HTTP 200 OK`, `{"status": "delivered", "mailbox": "acy7kpS_s8dpYvjRFIBVY"}`.

---

## 4. Git Synchronization & VM Rebuildability

### Clean Rebuild Assurance:
* **GitHub Repository:** `git@github.com:shihan-shereef/hyparlink.git`
* **Latest Commit:** `9decbff` (`feat(security & trash): harden auth middleware, dual password/otp login, and video trash system`)
* **Verification Command on VM:**
  ```bash
  cd /home/shihan/hyparlink
  git status # Clean worktree, HEAD is at 9decbff
  npm run build # Successfully built Next.js and Convex artifacts without errors
  pm2 status # All 4 processes (backend-echo, nextjs-app, tunnel-convex, tunnel-app) online
  ```

---

## 5. Summary Matrix

| Vulnerability | Severity | Status | Verification Check |
|---|---|---|---|
| Unauthenticated Admin Impersonation | Critical | ✅ Resolved | `packages/backend/convex/users.ts` strictly checks `userId` |
| Missing Route Protection Middleware | High | ✅ Resolved | `/projects` returns `HTTP 307` redirect to `/login` |
| Open Dev OTP Interception Endpoint | High | ✅ Resolved | `/api/dev-otp` returns `403 Forbidden` in production |
| Hardcoded Ollastack API Key | Medium | ✅ Resolved | Migrated to `.env` variables |
| Irreversible Project Deletion | Medium | ✅ Resolved | Soft-delete Trash + Restore + Empty Trash implemented |
| Dual Password / OTP Login | Requirement | ✅ Implemented | Tested both password and Ollastack OTP flows |
| Clean Rebuild from Git Repo | Requirement | ✅ Verified | Both local and VM `npm run build` pass with exit code 0 |
