import type { OperationalIntelligenceContext } from "@paperclipai/shared";

export function IssueOperationalIntelligence({
  context,
  failed = false,
}: {
  context: OperationalIntelligenceContext | null | undefined;
  failed?: boolean;
}) {
  if (failed) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">Operational intelligence unavailable</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paperclip could not load the task&apos;s plan, routing, session, and outcome context.
        </p>
      </section>
    );
  }
  if (!context?.enabled) return null;

  const planState = !context.planning.required
    ? "Optional"
    : context.planning.approved
      ? "Approved"
      : context.planning.hasPlan
        ? "Awaiting approval"
        : "Required";

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-foreground">Operational intelligence</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Persistent plan, routing, session reuse, and prior outcomes for this task.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Task class</dt>
          <dd className="mt-1 capitalize text-foreground">{context.taskClass}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Model lane</dt>
          <dd className="mt-1 capitalize text-foreground">{context.routing.appliedLane}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="mt-1 text-foreground">{planState}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Session</dt>
          <dd className="mt-1 text-foreground">
            {context.session.reusable ? context.session.displayId ?? "Reusable" : "Fresh"}
          </dd>
        </div>
      </dl>
      {context.memory.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-foreground">Relevant prior outcomes</h3>
          {context.memory.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-foreground">{item.title}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {item.metadata.status}{item.metadata.score ? ` · ${item.metadata.score}/5` : ""}
                </span>
              </div>
              {item.summary ? <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
