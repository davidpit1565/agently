import { describe, expect, it } from "vitest";
import {
  isValidUpgradeReasonCode,
  isWithinUpgradeReasonWindow,
  UPGRADE_REASON_WINDOW_MS,
} from "./upgrade-reasons";

describe("isValidUpgradeReasonCode", () => {
  it("accepts every code in the allow-list", () => {
    expect(isValidUpgradeReasonCode("more_listings")).toBe(true);
    expect(isValidUpgradeReasonCode("priority_support")).toBe(true);
    expect(isValidUpgradeReasonCode("team_growing")).toBe(true);
    expect(isValidUpgradeReasonCode("recommended")).toBe(true);
    expect(isValidUpgradeReasonCode("other")).toBe(true);
  });

  it("rejects anything not in the allow-list — the whole point of an allow-list", () => {
    expect(isValidUpgradeReasonCode("too_expensive")).toBe(false); // a cancellation code, not an upgrade one
    expect(isValidUpgradeReasonCode("'; drop table agently_membership_events; --")).toBe(false);
    expect(isValidUpgradeReasonCode("")).toBe(false);
  });

  it("rejects non-string values a malformed request body could send", () => {
    expect(isValidUpgradeReasonCode(null)).toBe(false);
    expect(isValidUpgradeReasonCode(undefined)).toBe(false);
    expect(isValidUpgradeReasonCode(42)).toBe(false);
    expect(isValidUpgradeReasonCode({ reasonCode: "other" })).toBe(false);
  });
});

describe("isWithinUpgradeReasonWindow", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("accepts a row created moments ago", () => {
    const createdAt = new Date(now.getTime() - 1000).toISOString();
    expect(isWithinUpgradeReasonWindow(createdAt, now)).toBe(true);
  });

  it("accepts a row right at the edge of the window", () => {
    const createdAt = new Date(now.getTime() - UPGRADE_REASON_WINDOW_MS).toISOString();
    expect(isWithinUpgradeReasonWindow(createdAt, now)).toBe(true);
  });

  it("rejects a row just past the window — a stale tier change from days ago must not be able to attach", () => {
    const createdAt = new Date(now.getTime() - UPGRADE_REASON_WINDOW_MS - 1000).toISOString();
    expect(isWithinUpgradeReasonWindow(createdAt, now)).toBe(false);
  });

  it("rejects an unparsable timestamp instead of throwing", () => {
    expect(isWithinUpgradeReasonWindow("not-a-date", now)).toBe(false);
  });

  it("rejects a timestamp in the future (clock skew) rather than treating it as fresh", () => {
    const createdAt = new Date(now.getTime() + 5000).toISOString();
    expect(isWithinUpgradeReasonWindow(createdAt, now)).toBe(false);
  });
});
