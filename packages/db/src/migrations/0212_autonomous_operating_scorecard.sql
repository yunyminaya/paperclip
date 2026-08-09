CREATE TABLE "goal_metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"reported_by_agent_id" uuid,
	"heartbeat_run_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "metric_key" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "metric_unit" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_value" double precision;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "target_operator" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goal_metric_observations" ADD CONSTRAINT "goal_metric_observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_metric_observations" ADD CONSTRAINT "goal_metric_observations_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_metric_observations" ADD CONSTRAINT "goal_metric_observations_reported_by_agent_id_agents_id_fk" FOREIGN KEY ("reported_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_metric_observations" ADD CONSTRAINT "goal_metric_observations_heartbeat_run_id_heartbeat_runs_id_fk" FOREIGN KEY ("heartbeat_run_id") REFERENCES "public"."heartbeat_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_metric_observations_company_goal_observed_idx" ON "goal_metric_observations" USING btree ("company_id","goal_id","observed_at");--> statement-breakpoint
