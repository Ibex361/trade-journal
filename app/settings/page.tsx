import AccountManager from "@/components/settings/AccountManager";
import DropdownLists from "@/components/settings/DropdownLists";
import TargetsCard from "@/components/settings/TargetsCard";
import WinRateModeCard from "@/components/settings/WinRateModeCard";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">
          Settings
        </h1>
        <p className="text-ink-secondary text-sm mt-1">
          Manage accounts, dropdown lists, and targets.
        </p>
      </div>

      <AccountManager />
      <TargetsCard />
      <WinRateModeCard />
      <DropdownLists />
    </div>
  );
}
