import { createAdminClient } from "@/lib/supabase/admin";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const BUCKET = "agent-files";

// A creator can upload a listing's files without ever seeing another
// listing's — random per-file path segment, not the file name, so two
// creators uploading a file named the same thing (README.md is common)
// never collide, and nothing about a path can be guessed from another
// agent's known id.
function storagePath(agentId: string, fileName: string) {
  return `${agentId}/${crypto.randomUUID()}-${fileName}`;
}

function looksLikeReadme(fileName: string) {
  return /^readme(\.(md|markdown|txt))?$/i.test(fileName);
}

export type AgentFile = {
  id: string;
  agent_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  is_readme: boolean;
  created_at: string;
};

/** Uploads every file in the list to the private bucket and records each
 *  one. Called only from server routes that already checked the caller
 *  owns `agentId` — see the schema.sql comment on agent_files for why this
 *  uses the service-role client instead of Storage RLS. */
export async function uploadAgentFiles(agentId: string, files: File[]): Promise<void> {
  const admin = createAdminClient();
  if (!admin || files.length === 0) return;

  for (const file of files) {
    if (file.size === 0) continue; // an empty <input type="file"> still submits one zero-byte entry
    const path = storagePath(agentId, file.name);
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) continue; // one bad file shouldn't fail the whole submission

    await admin.from("agent_files").insert({
      agent_id: agentId,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      is_readme: looksLikeReadme(file.name),
    });
  }
}

export async function getAgentFiles(agentId: string): Promise<AgentFile[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("agent_files")
    .select("*")
    .eq("agent_id", agentId)
    .order("is_readme", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as AgentFile[];
}

export async function deleteAgentFile(fileId: string, agentId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: file } = await admin
    .from("agent_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("agent_id", agentId) // never delete a file by id alone — confirm it belongs to this agent
    .single();
  if (!file) return;

  await admin.storage.from(BUCKET).remove([file.storage_path]);
  await admin.from("agent_files").delete().eq("id", fileId);
}

/** Short-lived download link — generated fresh on every page render for an
 *  already-authorized viewer (owner or paid buyer, checked by the caller),
 *  never stored. Long enough to click through a page load, short enough
 *  that a copied link stops working soon after. */
export async function getSignedFileUrl(storagePath: string, expiresInSeconds = 300): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "p", "a", "ul", "ol", "li", "blockquote",
    "code", "pre", "strong", "em", "hr", "br", "table", "thead", "tbody",
    "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
  },
  // Every link opens safely and never inherits the page's own auth
  // context — a README is arbitrary text a creator wrote, not code we
  // reviewed, so treat every link in it as untrusted.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

/** Renders a listing's README (if it has one) to sanitized HTML. Markdown
 *  parsing (marked) happens first, then sanitize-html strips anything a
 *  malicious upload tried to smuggle in (script tags, event handlers,
 *  javascript: URLs) before this ever reaches dangerouslySetInnerHTML —
 *  this is user-submitted content, not something the safety review reads. */
export async function getReadmeHtml(agentId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: readmeRow } = await admin
    .from("agent_files")
    .select("storage_path")
    .eq("agent_id", agentId)
    .eq("is_readme", true)
    .limit(1)
    .maybeSingle();
  if (!readmeRow) return null;

  const { data: blob, error } = await admin.storage.from(BUCKET).download(readmeRow.storage_path);
  if (error || !blob) return null;

  const markdown = await blob.text();
  const html = await marked.parse(markdown);
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
