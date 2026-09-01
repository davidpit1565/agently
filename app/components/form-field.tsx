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
    <label className="group flex flex-col gap-1 text-sm">
      <span className="font-medium transition-colors duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-focus-within:text-accent">
        {label}
      </span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={3}
          defaultValue={defaultValue}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          defaultValue={defaultValue}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
        />
      )}
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md animate-reveal-up px-6 py-24 text-center">
      <h1 className="text-balance mb-2 font-display text-xl font-semibold">{title}</h1>
      <p className="text-sm text-ink-soft">{children}</p>
    </main>
  );
}
