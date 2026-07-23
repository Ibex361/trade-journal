import Card from "@/components/shared/Card";

/**
 * Thin wrapper kept for backward compatibility with the Settings page's
 * existing imports — all it does now is call the new shared Card. Fold this
 * into a direct <Card> usage when Step 4 reaches the Settings page.
 */
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
    <Card title={title} description={description}>
      {children}
    </Card>
  );
}
