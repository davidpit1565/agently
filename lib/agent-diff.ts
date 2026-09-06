/** Builds a plain-language summary of what changed between an agent's
 *  stored fields and a submitted edit — shown on the admin review page and
 *  mailed to the platform owner, so a re-review shows exactly what a
 *  creator changed instead of just the new version with nothing to compare
 *  it against. Description is called out by length, not quoted in full —
 *  it can be long enough to make the notes/email unreadable, and the
 *  admin page still links to the full current text. */
export function buildAgentEditDiff(
  before: { name: string; tagline: string; problem_solved: string; description: string },
  after: { name: string; tagline: string; problemSolved: string; description: string }
): string {
  const lines: string[] = [];

  if (before.name !== after.name) {
    lines.push(`Name: "${before.name}" → "${after.name}"`);
  }
  if (before.tagline !== after.tagline) {
    lines.push(`Tagline: "${before.tagline}" → "${after.tagline}"`);
  }
  if (before.problem_solved !== after.problemSolved) {
    lines.push(`Problem solved: "${before.problem_solved}" → "${after.problemSolved}"`);
  }
  if (before.description !== after.description) {
    lines.push(`Description changed (${before.description.length} → ${after.description.length} characters).`);
  }

  return lines.length > 0 ? lines.join("\n") : "No visible field changed.";
}
