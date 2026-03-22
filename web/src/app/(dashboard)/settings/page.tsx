export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application settings
        </p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Update your personal information and preferences.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Team</h2>
          <p className="text-sm text-muted-foreground">
            Manage team members and their roles.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect your omnichannel tools and third-party services.
          </p>
        </div>
      </div>
    </div>
  );
}
