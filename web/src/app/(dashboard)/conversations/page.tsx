export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground">
          View and manage all customer conversations across channels
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <p className="text-center text-muted-foreground">
          No conversations yet. Conversations will appear here when customers
          reach out.
        </p>
      </div>
    </div>
  );
}
