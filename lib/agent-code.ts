/** Deterministic short code from an agent's id, e.g. "AGT-4F2A" — decorative,
 *  not a real identifier scheme, just gives each listing a stable console-style tag. */
export function agentCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `AGT-${hash.toString(16).slice(0, 4).toUpperCase().padStart(4, "0")}`;
}
