export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your CRM contacts and leads
          </p>
        </div>
        <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Contact
        </button>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-center text-muted-foreground">
          No contacts yet. Add your first contact to get started.
        </p>
      </div>
    </div>
  );
}
