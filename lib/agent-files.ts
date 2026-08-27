import { createAdminClient } from "@/lib/supabase/admin";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const BUCKET = "agent-files";

// Supabase's own hard ceiling on the free tier — a larger upload fails at
// their end regardless of what this app allows, so check it here first
// and say why in a way a creator can actually act on, instead of letting
// it fail silently inside uploadAgentFiles below.
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

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

export type FileUploadResult = {
  uploaded: number;
  /** File name + why it didn't make it — a creator who picked a 200MB
   *  video should be told that, not left assuming it's sitting on the
   *  listing when it silently never arrived. */
  rejected: { name: string; reason: string }[];
};

/** Uploads every file in the list to the private bucket and records each
 *  one. Called only from server routes that already checked the caller
 *  owns `agentId` — see the schema.sql comment on agent_files for why this
 *  uses the service-role client instead of Storage RLS. */
export async function uploadAgentFiles(agentId: string, files: File[]): Promise<FileUploadResult> {
  const result: FileUploadResult = { uploaded: 0, rejected: [] };
  const admin = createAdminClient();
  if (!admin || files.length === 0) return result;

  for (const file of files) {
    if (file.size === 0) continue; // an empty <input type="file"> still submits one zero-byte entry

    if (file.size > MAX_FILE_SIZE_BYTES) {
      result.rejected.push({ name: file.name, reason: "over the 50MB limit" });
      continue;
    }

    const path = storagePath(agentId, file.name);
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) {
      result.rejected.push({ name: file.name, reason: "upload failed" });
      continue; // one bad file shouldn't fail the whole submission
    }

    const { error: insertError } = await admin.from("agent_files").insert({
      agent_id: agentId,
      file_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      is_readme: looksLikeReadme(file.name),
    });
    if (insertError) {
      // The blob is already in Storage but with no row pointing at it —
      // clean it up rather than leaving an orphaned file no UI ever lists.
      await admin.storage.from(BUCKET).remove([path]);
      result.rejected.push({ name: file.name, reason: "upload failed" });
      continue;
    }

    result.uploaded++;
  }

  return result;
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

/** One batched query for a whole listing grid (browse, a creator's own
 *  agents) instead of one query per card — which file a listing has
 *  doesn't matter here, only whether it has any real deliverable
 *  attached, so a buyer can tell a completed listing from a bare
 *  description before ever clicking in. */
export async function getAgentIdsWithFiles(agentIds: string[]): Promise<Set<string>> {
  const admin = createAdminClient();
  if (!admin || agentIds.length === 0) return new Set();

  const { data, error } = await admin
    .from("agent_files")
    .select("agent_id")
    .in("agent_id", agentIds)
    .eq("is_readme", false);

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.agent_id as string));
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
