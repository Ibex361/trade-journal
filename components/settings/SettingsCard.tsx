export default function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface-1 border border-surface-border rounded-card p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="signal-bar h-6 mt-0.5" />
        <div>
          <h2 className="font-display text-lg font-medium">{title}</h2>
          {description && (
            <p className="text-ink-secondary text-sm mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
