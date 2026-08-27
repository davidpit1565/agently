export function Field({
  label,
  name,
  required,
  textarea,
  type = "text",
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  textarea?: boolean;
  type?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={3}
          defaultValue={defaultValue}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent"
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent"
        />
      )}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md animate-fade-up px-6 py-24 text-center">
      <h1 className="text-balance mb-2 font-display text-xl font-semibold">{title}</h1>
      <p className="text-sm text-ink-soft">{children}</p>
    </main>
  );
}
