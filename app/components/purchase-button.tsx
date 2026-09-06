"use client";

import { useState } from "react";
import { SubmitButton } from "@/app/components/submit-button";
import { TeamSeatsPicker } from "@/app/components/team-seats-picker";
import { MIN_TEAM_SEATS, MAX_TEAM_SEATS, teamPriceCents } from "@/lib/team-pricing";
import { formatEuros } from "@/lib/format";

// The Buy button used to show only the single-buyer price, even after
// picking a team seat count below it — the live total from TeamSeatsPicker
// sat right next to a button that never updated, so what the button
// promised and what checkout actually charged could visibly disagree. Both
// need the same `seats` value, so this owns that state and passes it down
// instead of each tracking its own.
export function PurchaseButton({
  pricingModel,
  basePriceCents,
  baseLabel,
}: {
  pricingModel: "free" | "one_time" | "subscription";
  basePriceCents: number;
  /** Precomputed priceLabel(agent) for a single buyer — "Free", "€X / month", or "€X one-time". */
  baseLabel: string;
}) {
  const [seats, setSeats] = useState(1);
  const isTeamEligible = pricingModel === "one_time";
  const isTeamPurchase = isTeamEligible && seats >= MIN_TEAM_SEATS;

  const label =
    pricingModel === "free"
      ? "Get this agent"
      : isTeamPurchase
        ? `Buy — €${formatEuros(teamPriceCents(basePriceCents, seats))} for ${seats}`
        : `Buy — ${baseLabel}`;

  return (
    <>
      <SubmitButton
        pendingText={pricingModel === "free" ? "Getting it…" : "Redirecting to checkout…"}
        className="shine-sweep magnetic-btn group flex w-fit items-center gap-2 rounded-full bg-accent py-2 pl-6 pr-2 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
      >
        {label}
        <span className="magnetic-icon flex h-8 w-8 items-center justify-center rounded-full bg-black/10">→</span>
      </SubmitButton>

      {/* Team licensing (lib/team-pricing.ts): only makes sense for a
          one-time purchase — a subscription's recurring billing has no
          clean place to attach a one-time seat discount, and a free agent
          has nothing to discount. Left collapsed by default so it doesn't
          compete with the single-buyer path most people want. Submits
          through the same form: "seats" defaults to the plain "1" via
          useState above, so opening this and not touching anything is
          identical to an ordinary purchase. */}
      {isTeamEligible && (
        <details className="details-anim w-fit rounded-lg border border-line bg-surface px-4 py-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-soft">Buying for a team?</summary>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <p className="max-w-sm text-pretty text-xs leading-relaxed text-ink-faint">
              From {MIN_TEAM_SEATS} to {MAX_TEAM_SEATS} seats, cheaper per seat the more you add.
              Everyone you list gets an email with their own access link right after checkout.
            </p>
            <TeamSeatsPicker basePriceCents={basePriceCents} seats={seats} onSeatsChange={setSeats} />
            <label className="flex flex-col gap-1 text-xs text-ink-soft">
              Teammate emails — one per line, one fewer than the seat count above
              <textarea
                name="team_emails"
                rows={3}
                placeholder={"teammate1@company.com\nteammate2@company.com"}
                className="w-full max-w-sm rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
              />
            </label>
          </div>
        </details>
      )}
    </>
  );
}
