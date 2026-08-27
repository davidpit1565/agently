import { createClient } from "@/lib/supabase/server";
import { Field, Notice } from "@/app/components/form-field";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before there's a profile to edit.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to have a profile.</Notice>;
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("display_name, account_type, company_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Your profile</h1>
      <p className="mb-8 text-sm text-ink-faint">
        This is what shows on your creator page — {" "}
        <span className="text-ink-soft">{user.email}</span> stays private.
      </p>

      {saved && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Saved.
        </p>
      )}

      <form action="/api/profile" method="POST" className="flex flex-col gap-4">
        <Field label="Display name" name="display_name" required defaultValue={profile?.display_name} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Account type</span>
          <select
            name="account_type"
            defaultValue={profile?.account_type ?? "individual"}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none focus:border-accent"
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
        </label>

        <Field
          label="Company name"
          name="company_name"
          defaultValue={profile?.company_name ?? undefined}
          hint="Only shown if account type is Company."
        />

        <button
          type="submit"
          className="mt-2 w-fit rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] hover:opacity-90"
        >
          Save
        </button>
      </form>
    </main>
  );
}
