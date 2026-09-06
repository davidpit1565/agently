import { describe, expect, it, vi } from "vitest";
import { validateHostedAgentFields, deductCredits, refundCredits } from "./hosted-agents";

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
