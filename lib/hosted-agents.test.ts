import { describe, expect, it, vi } from "vitest";
import {
  validateHostedAgentFields,
  deductCredits,
  refundCredits,
  checkInvokeEligibility,
  checkAndAlertOnFailureRate,
} from "./hosted-agents";

describe("validateHostedAgentFields", () => {
  it("accepts 'file' and blanks out every hosted-only field regardless of what was submitted", () => {
    const result = validateHostedAgentFields({
      agentKind: "file",
      hostedSystemPrompt: "leftover text",
      hostedWebhookUrl: "https://example.com/hook",
      creditsPerCall: "5",
    });
    expect(result).toEqual({
      ok: true,
      fields: { agentKind: "file", hostedSystemPrompt: null, hostedWebhookUrl: null, creditsPerCall: null },
    });
  });

  it("rejects an unknown agent_kind", () => {
    const result = validateHostedAgentFields({
      agentKind: "sandboxed_code",
      hostedSystemPrompt: null,
      hostedWebhookUrl: null,
      creditsPerCall: null,
    });
    expect(result.ok).toBe(false);
  });

  describe("agent_kind = 'prompt'", () => {
    it("requires a non-empty hosted_system_prompt", () => {
      const result = validateHostedAgentFields({
        agentKind: "prompt",
        hostedSystemPrompt: "   ",
        hostedWebhookUrl: null,
        creditsPerCall: "10",
      });
      expect(result.ok).toBe(false);
    });

    it("requires credits_per_call to be a positive integer", () => {
      for (const bad of ["0", "-3", "1.5", "abc", null]) {
        const result = validateHostedAgentFields({
          agentKind: "prompt",
          hostedSystemPrompt: "You are a helpful assistant.",
          hostedWebhookUrl: null,
          creditsPerCall: bad,
        });
        expect(result.ok, `credits_per_call=${bad} should be rejected`).toBe(false);
      }
    });

    it("accepts a valid prompt agent and trims the prompt", () => {
      const result = validateHostedAgentFields({
        agentKind: "prompt",
        hostedSystemPrompt: "  You are a helpful assistant.  ",
        hostedWebhookUrl: null,
        creditsPerCall: "10",
      });
      expect(result).toEqual({
        ok: true,
        fields: {
          agentKind: "prompt",
          hostedSystemPrompt: "You are a helpful assistant.",
          hostedWebhookUrl: null,
          creditsPerCall: 10,
        },
      });
    });
  });

  describe("agent_kind = 'workflow'", () => {
    it("rejects a missing or non-http(s) webhook URL — same rule as every other user-supplied URL in this app", () => {
      for (const bad of [null, "", "javascript:alert(1)", "ftp://example.com/hook", "not a url"]) {
        const result = validateHostedAgentFields({
          agentKind: "workflow",
          hostedSystemPrompt: null,
          hostedWebhookUrl: bad,
          creditsPerCall: "5",
        });
        expect(result.ok, `hosted_webhook_url=${bad} should be rejected`).toBe(false);
      }
    });

    it("rejects a webhook URL pointing at a private or internal address (SSRF)", () => {
      for (const bad of [
        "http://127.0.0.1/hook",
        "http://localhost:3000/hook",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/hook",
        "https://box.internal/hook",
      ]) {
        const result = validateHostedAgentFields({
          agentKind: "workflow",
          hostedSystemPrompt: null,
          hostedWebhookUrl: bad,
          creditsPerCall: "5",
        });
        expect(result.ok, `hosted_webhook_url=${bad} should be rejected`).toBe(false);
      }
    });

    it("accepts a valid https webhook agent", () => {
      const result = validateHostedAgentFields({
        agentKind: "workflow",
        hostedSystemPrompt: null,
        hostedWebhookUrl: "https://n8n.example.com/webhook/abc123",
        creditsPerCall: "3",
      });
      expect(result).toEqual({
        ok: true,
        fields: {
          agentKind: "workflow",
          hostedSystemPrompt: null,
          hostedWebhookUrl: "https://n8n.example.com/webhook/abc123",
          creditsPerCall: 3,
        },
      });
    });
  });
});

describe("checkInvokeEligibility", () => {
  it("allows a non-member with credits remaining to invoke — the free-trial-without-membership decision", () => {
    const result = checkInvokeEligibility({ membershipStatus: null, apiCredits: 20 }, 5);
    expect(result).toEqual({ ok: true });
  });

  it("allows a non-member whose membership_status is some non-'active' value, as long as credits remain", () => {
    const result = checkInvokeEligibility({ membershipStatus: "canceled", apiCredits: 3 }, 3);
    expect(result).toEqual({ ok: true });
  });

  it("blocks a non-member with zero credits left, with the sign-up-for-credits message", () => {
    const result = checkInvokeEligibility({ membershipStatus: null, apiCredits: 0 }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/no active membership/i);
      expect(result.error).toMatch(/no free credits left/i);
    }
  });

  it("blocks an active member with zero credits left — membership never waives the credit cost itself", () => {
    const result = checkInvokeEligibility({ membershipStatus: "active", apiCredits: 0 }, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // A member's own wallet is still empty, not "no membership" — the
      // distinct combined-failure message only applies to non-members.
      expect(result.error).toBe("Not enough credits for this call.");
    }
  });

  it("blocks an active member whose remaining credits don't cover this call's cost", () => {
    const result = checkInvokeEligibility({ membershipStatus: "active", apiCredits: 2 }, 5);
    expect(result).toEqual({ ok: false, error: "Not enough credits for this call." });
  });

  it("blocks a non-member with some credits, but fewer than this call's cost", () => {
    const result = checkInvokeEligibility({ membershipStatus: null, apiCredits: 2 }, 5);
    expect(result).toEqual({ ok: false, error: "Not enough credits for this call." });
  });

  it("keeps the two failure messages distinguishable from each other", () => {
    const noMembershipNoCredits = checkInvokeEligibility({ membershipStatus: null, apiCredits: 0 }, 5);
    const insufficientCredits = checkInvokeEligibility({ membershipStatus: "active", apiCredits: 0 }, 5);
    expect(noMembershipNoCredits.ok).toBe(false);
    expect(insufficientCredits.ok).toBe(false);
    if (!noMembershipNoCredits.ok && !insufficientCredits.ok) {
      expect(noMembershipNoCredits.error).not.toBe(insufficientCredits.error);
    }
  });
});

// A minimal fake of the one supabase-js method these functions actually
// call (.rpc) — enough to exercise the real decision logic in
// deductCredits/refundCredits without a live database.
function fakeAdmin(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { admin: { rpc } as unknown as Parameters<typeof deductCredits>[0], rpc };
}

describe("deductCredits", () => {
  it("treats the guarded UPDATE affecting zero rows as insufficient credits, not an error — the race-condition guard", async () => {
    const { admin } = fakeAdmin({ data: false, error: null });
    const result = await deductCredits(admin, "user-1", 10);
    expect(result).toEqual({ deducted: false });
  });

  it("treats the guarded UPDATE affecting a row as a successful deduction", async () => {
    const { admin } = fakeAdmin({ data: true, error: null });
    const result = await deductCredits(admin, "user-1", 10);
    expect(result).toEqual({ deducted: true });
  });

  it("surfaces a real RPC error distinctly from 'insufficient credits'", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "connection refused" } });
    const result = await deductCredits(admin, "user-1", 10);
    expect(result.deducted).toBe(false);
    expect(result.error).toBe("connection refused");
  });

  it("calls the atomic RPC with exactly the requested cost, never computing the new balance in application code", async () => {
    const { admin, rpc } = fakeAdmin({ data: true, error: null });
    await deductCredits(admin, "user-42", 7);
    expect(rpc).toHaveBeenCalledWith("agently_deduct_credits", { profile_id: "user-42", cost: 7 });
  });
});

describe("refundCredits", () => {
  it("calls the atomic add-credits RPC with the exact amount to refund", async () => {
    const { admin, rpc } = fakeAdmin({ data: undefined, error: null });
    await refundCredits(admin, "user-1", 10);
    expect(rpc).toHaveBeenCalledWith("agently_add_credits", { profile_id: "user-1", amount: 10 });
  });

  it("logs but does not throw when the refund RPC itself fails", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "db down" } });
    await expect(refundCredits(admin, "user-1", 10)).resolves.toBeUndefined();
  });
});

// A minimal fake of the .from(...).select(...).eq(...).order(...).limit(...)
// (recent invocations), .from(...).select(...).eq(...).maybeSingle() (the
// agent's last_alert_sent_at) and .from(...).update(...).eq(...) (stamping
// last_alert_sent_at) chains checkAndAlertOnFailureRate actually calls —
// same "fake only the methods actually used" spirit as fakeAdmin() above,
// just extended to a chained query builder instead of a single .rpc() call.
function fakeAlertAdmin(opts: {
  invocations: { data?: unknown; error?: { message: string } | null };
  agent?: { data?: unknown; error?: { message: string } | null };
}) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));

  const maybeSingle = vi.fn().mockResolvedValue(opts.agent ?? { data: null, error: null });
  const agentEq = vi.fn(() => ({ maybeSingle }));
  const agentSelect = vi.fn(() => ({ eq: agentEq }));

  const limit = vi.fn().mockResolvedValue(opts.invocations);
  const order = vi.fn(() => ({ limit }));
  const invocationsEq = vi.fn(() => ({ order }));
  const invocationsSelect = vi.fn(() => ({ eq: invocationsEq }));

  const from = vi.fn((table: string) => {
    if (table === "agently_agent_invocations") return { select: invocationsSelect };
    if (table === "agently_agents") return { select: agentSelect, update };
    throw new Error(`fakeAlertAdmin: unexpected table ${table}`);
  });

  return {
    admin: { from } as unknown as Parameters<typeof checkAndAlertOnFailureRate>[0],
    from,
    update,
    updateEq,
  };
}

describe("checkAndAlertOnFailureRate", () => {
  it("does not alert when fewer than 3 of the last 10 invocations failed", async () => {
    const { admin, from } = fakeAlertAdmin({
      invocations: {
        data: [
          { succeeded: false, error_message: "Webhook call failed (503)" },
          { succeeded: true, error_message: null },
          { succeeded: true, error_message: null },
        ],
        error: null,
      },
    });

    await checkAndAlertOnFailureRate(admin, "agent-1", "My Agent");

    // Only ever queried the invocations table — never even looked at
    // last_alert_sent_at, since the threshold wasn't met.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("agently_agent_invocations");
  });

  it("alerts when 3 or more of the last 10 invocations failed and there is no prior alert", async () => {
    const { admin, update, updateEq } = fakeAlertAdmin({
      invocations: {
        data: [
          { succeeded: false, error_message: "Anthropic API call failed (529)" },
          { succeeded: false, error_message: "Anthropic API call failed (529)" },
          { succeeded: false, error_message: "Anthropic API call failed (529)" },
          { succeeded: true, error_message: null },
        ],
        error: null,
      },
      agent: { data: { last_alert_sent_at: null }, error: null },
    });

    await checkAndAlertOnFailureRate(admin, "agent-1", "My Agent");

    expect(update).toHaveBeenCalledWith({ last_alert_sent_at: expect.any(String) });
    expect(updateEq).toHaveBeenCalledWith("id", "agent-1");
  });

  it("treats fewer than 10 logged calls total as eligible, as long as at least 3 failed", async () => {
    const { admin, update } = fakeAlertAdmin({
      invocations: {
        data: [
          { succeeded: false, error_message: "Workflow timed out" },
          { succeeded: false, error_message: "Workflow timed out" },
          { succeeded: false, error_message: "Workflow timed out" },
        ],
        error: null,
      },
      agent: { data: { last_alert_sent_at: null }, error: null },
    });

    await checkAndAlertOnFailureRate(admin, "agent-1", "My Agent");

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("does not send a second alert while the cooldown (1 hour) hasn't passed", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { admin, update } = fakeAlertAdmin({
      invocations: {
        data: [
          { succeeded: false, error_message: "Webhook call failed (500)" },
          { succeeded: false, error_message: "Webhook call failed (500)" },
          { succeeded: false, error_message: "Webhook call failed (500)" },
        ],
        error: null,
      },
      agent: { data: { last_alert_sent_at: fiveMinutesAgo }, error: null },
    });

    await checkAndAlertOnFailureRate(admin, "agent-1", "My Agent");

    expect(update).not.toHaveBeenCalled();
  });

  it("alerts again once the cooldown has expired", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { admin, update } = fakeAlertAdmin({
      invocations: {
        data: [
          { succeeded: false, error_message: "Webhook call failed (500)" },
          { succeeded: false, error_message: "Webhook call failed (500)" },
          { succeeded: false, error_message: "Webhook call failed (500)" },
        ],
        error: null,
      },
      agent: { data: { last_alert_sent_at: twoHoursAgo }, error: null },
    });

    await checkAndAlertOnFailureRate(admin, "agent-1", "My Agent");

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("never throws when the invocations query itself fails", async () => {
    const { admin } = fakeAlertAdmin({ invocations: { data: null, error: { message: "connection refused" } } });
    await expect(checkAndAlertOnFailureRate(admin, "agent-1", "My Agent")).resolves.toBeUndefined();
  });
});
