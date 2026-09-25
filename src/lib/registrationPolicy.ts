/**
 * Registration policy — pure, dependency-free decision logic.
 *
 * Deliberately free of any Prisma import so the security invariant can be
 * unit-tested directly (importing a Prisma-backed module needs DATABASE_URL
 * and a live adapter). The route handler owns all database access and defers
 * every accept/reject decision here.
 *
 * THE INVARIANT: a signup request may only ever CREATE an approval row. An
 * existing row — in ANY status — blocks a new request for that email.
 *
 * Why that matters: approving a request creates the user with the password
 * hash stored on the approval row (see /api/admin/approvals). If an
 * unauthenticated registration could rewrite an existing row, anyone could
 * resurrect a rejected applicant under an email they don't control, choosing
 * the name, section, and password. One routine admin approval would then hand
 * the attacker a working account under that identity. So a stale row is not
 * something a stranger may overwrite — it is cleared by an admin, after which
 * the real applicant re-applies.
 */

/** The single answer for every conflict, so the endpoint can't be used to
 *  distinguish "registered" from "requested" from "was rejected". */
export const REGISTRATION_CONFLICT_MESSAGE =
  "This email address is already in use.";

export type ApprovalStatus = "PENDING" | "REJECTED" | "APPROVED";

export interface RegistrationFacts {
  /** A live account already owns this email. */
  userExists: boolean;
  /** Status of any pre-existing signup request, or null when there is none. */
  approvalStatus: ApprovalStatus | null;
}

export type RegistrationDecision =
  | { ok: true }
  | { ok: false; reason: "registered" | "pending" | "stale-request" };

export function decideRegistration(
  facts: RegistrationFacts,
): RegistrationDecision {
  if (facts.userExists) return { ok: false, reason: "registered" };
  if (facts.approvalStatus === "PENDING") {
    return { ok: false, reason: "pending" };
  }
  /* A REJECTED or APPROVED-but-orphaned row is a stale request. It blocks the
     email until an admin deletes it — the applicant may then re-apply. This is
     the branch that used to fall through into an upsert that overwrote the
     stored password, name, and section. */
  if (facts.approvalStatus !== null) {
    return { ok: false, reason: "stale-request" };
  }
  return { ok: true };
}
