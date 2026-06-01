"""Phase 1B Week 7-10: gantt, daily_reports, attendance, schedule, purchase, comments + photo columns.

Revision ID: g1h2i3j4k5l6
Revises: e2f3a4b5c6d7
Create Date: 2026-05-25 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "g1h2i3j4k5l6"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None

# Shorthand helpers so column defs stay readable
def _enum(name: str, *values: str) -> postgresql.ENUM:
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    # ── 1. 新規 ENUM 型（べき等: 存在する場合はスキップ） ──────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE taskstatus AS ENUM ('planned','in_progress','completed','delayed');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE taskdependencytype AS ENUM
                ('finish_to_start','start_to_start','finish_to_finish','start_to_finish');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE weathertype AS ENUM ('sunny','cloudy','rainy','snowy');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE phototype AS ENUM ('before','during','after','issue','drawing');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE scheduleeventtype AS ENUM
                ('meeting','site_visit','milestone','personal','vendor_visit');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE schedulevisibility AS ENUM ('public','private','team');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE attendeeresponse AS ENUM ('pending','accepted','declined');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE purchaseorderstatus AS ENUM
                ('draft','issued','partial_delivered','delivered','completed');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE deliverystatus AS ENUM ('pending','partial','delivered');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    # ── 2. work_type_master ───────────────────────────────────
    op.create_table(
        "work_type_master",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("default_color", sa.String(20), nullable=False, server_default="#3B82F6"),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("""
        INSERT INTO work_type_master (id, code, name, default_color, display_order) VALUES
          (gen_random_uuid(), 'temporary',  '仮設工事',          '#6B7280', 1),
          (gen_random_uuid(), 'demolition', '解体工事',          '#EF4444', 2),
          (gen_random_uuid(), 'earth',      '土工事',            '#92400E', 3),
          (gen_random_uuid(), 'concrete',   'コンクリート工事',  '#9CA3AF', 4),
          (gen_random_uuid(), 'steel',      '鉄骨工事',          '#6366F1', 5),
          (gen_random_uuid(), 'interior',   '内装工事',          '#F59E0B', 6),
          (gen_random_uuid(), 'exterior',   '外装工事',          '#10B981', 7),
          (gen_random_uuid(), 'electrical', '電気工事',          '#3B82F6', 8),
          (gen_random_uuid(), 'plumbing',   '設備工事',          '#06B6D4', 9),
          (gen_random_uuid(), 'cleaning',   '清掃・引渡',        '#84CC16', 10)
    """)

    # ── 3. project_tasks ─────────────────────────────────────
    op.create_table(
        "project_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("parent_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id"), nullable=True),
        sa.Column("task_no", sa.Integer, nullable=False, server_default="0"),
        sa.Column("task_name", sa.String(255), nullable=False),
        sa.Column("work_type", sa.String(50), nullable=True),
        sa.Column("work_type_master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("work_type_master.id"), nullable=True),
        sa.Column("planned_start", sa.Date, nullable=True),
        sa.Column("planned_end", sa.Date, nullable=True),
        sa.Column("actual_start", sa.Date, nullable=True),
        sa.Column("actual_end", sa.Date, nullable=True),
        sa.Column("progress_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("assigned_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("assigned_vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("dependency_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id"), nullable=True),
        sa.Column("dependency_type", _enum("taskdependencytype", "finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"), nullable=True),
        sa.Column("status", _enum("taskstatus", "planned", "in_progress", "completed", "delayed"), nullable=False, server_default="planned"),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_project_tasks_project_id", "project_tasks", ["project_id"])

    # ── 4. daily_reports ─────────────────────────────────────
    op.create_table(
        "daily_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("report_date", sa.Date, nullable=False),
        sa.Column("weather", _enum("weathertype", "sunny", "cloudy", "rainy", "snowy"), nullable=True),
        sa.Column("temperature", sa.Integer, nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_daily_reports_user_id", "daily_reports", ["user_id"])
    op.create_index("ix_daily_reports_report_date", "daily_reports", ["report_date"])

    # ── 5. daily_report_entries ───────────────────────────────
    op.create_table(
        "daily_report_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("daily_report_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("daily_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("project_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id"), nullable=True),
        sa.Column("work_content", sa.Text, nullable=True),
        sa.Column("start_time", sa.Time, nullable=True),
        sa.Column("end_time", sa.Time, nullable=True),
        sa.Column("break_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("working_minutes", sa.Integer, nullable=False, server_default="0"),
        sa.Column("progress_pct", sa.Integer, nullable=True),
        sa.Column("issues", sa.Text, nullable=True),
        sa.Column("tomorrow_plan", sa.Text, nullable=True),
    )
    op.create_index("ix_daily_report_entries_daily_report_id", "daily_report_entries", ["daily_report_id"])

    # ── 6. daily_report_attachments ──────────────────────────
    op.create_table(
        "daily_report_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("daily_report_entry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("daily_report_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("photo_type", _enum("phototype", "before", "during", "after", "issue", "drawing"), nullable=True),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("gps_latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("gps_longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 7. vendor_attendances ────────────────────────────────
    op.create_table(
        "vendor_attendances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("attendance_date", sa.Date, nullable=False),
        sa.Column("worker_count", sa.Numeric(4, 1), nullable=False, server_default="1"),
        sa.Column("worker_names", postgresql.ARRAY(sa.String(100)), nullable=True),
        sa.Column("work_content", sa.Text, nullable=True),
        sa.Column("start_time", sa.Time, nullable=True),
        sa.Column("end_time", sa.Time, nullable=True),
        sa.Column("unit_price", sa.Numeric(10, 0), nullable=True),
        sa.Column("amount", sa.Numeric(12, 0), nullable=True),
        sa.Column("recorded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("daily_report_entry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("daily_report_entries.id"), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vendor_attendances_project_id", "vendor_attendances", ["project_id"])
    op.create_index("ix_vendor_attendances_vendor_id", "vendor_attendances", ["vendor_id"])

    op.execute("""
        CREATE OR REPLACE VIEW vendor_attendance_summary AS
        SELECT
            project_id,
            vendor_id,
            DATE_TRUNC('month', attendance_date) AS month,
            SUM(worker_count)                    AS total_worker_count,
            COUNT(DISTINCT attendance_date)      AS working_days,
            SUM(amount)                          AS total_amount
        FROM vendor_attendances
        GROUP BY project_id, vendor_id, DATE_TRUNC('month', attendance_date)
    """)

    # ── 8. schedule_events ───────────────────────────────────
    op.create_table(
        "schedule_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("project_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_tasks.id"), nullable=True),
        sa.Column("event_type", _enum("scheduleeventtype", "meeting", "site_visit", "milestone", "personal", "vendor_visit"), nullable=False, server_default="meeting"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("all_day", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("organizer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("visibility", _enum("schedulevisibility", "public", "private", "team"), nullable=False, server_default="public"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_schedule_events_start_at", "schedule_events", ["start_at"])

    # ── 9. schedule_event_attendees ──────────────────────────
    op.create_table(
        "schedule_event_attendees",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("schedule_event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("schedule_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("response", _enum("attendeeresponse", "pending", "accepted", "declined"), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 10. purchase_orders ──────────────────────────────────
    op.create_table(
        "purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("qcds_direct_work_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("qcds_direct_works.id"), nullable=True),
        sa.Column("vendor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vendors.id"), nullable=False),
        sa.Column("order_number", sa.String(50), nullable=True),
        sa.Column("order_date", sa.Date, nullable=True),
        sa.Column("delivery_date", sa.Date, nullable=True),
        sa.Column("delivery_address", sa.Text, nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 0), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 0), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 0), nullable=False, server_default="0"),
        sa.Column("status", _enum("purchaseorderstatus", "draft", "issued", "partial_delivered", "delivered", "completed"), nullable=False, server_default="draft"),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_purchase_orders_project_id", "purchase_orders", ["project_id"])

    # ── 11. purchase_order_items ─────────────────────────────
    op.create_table(
        "purchase_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("row_no", sa.Integer, nullable=False, server_default="0"),
        sa.Column("item_name", sa.String(255), nullable=False),
        sa.Column("spec", sa.Text, nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 0), nullable=False, server_default="0"),
        sa.Column("amount", sa.Numeric(12, 0), nullable=False, server_default="0"),
        sa.Column("delivered_quantity", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("delivery_status", _enum("deliverystatus", "pending", "partial", "delivered"), nullable=False, server_default="pending"),
    )

    # ── 12. vendor_deliveries ────────────────────────────────
    op.create_table(
        "vendor_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("purchase_order_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("purchase_order_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False),
        sa.Column("received_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 13. project_comments ─────────────────────────────────
    op.create_table(
        "project_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("mentioned_user_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column("parent_comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_comments.id"), nullable=True),
        sa.Column("reactions", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_project_comments_project_id", "project_comments", ["project_id"])

    # ── 14. project_comment_attachments ──────────────────────
    op.create_table(
        "project_comment_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("comment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── 15. progress_attachments に写真台帳用カラム追加 ───────
    op.add_column("progress_attachments", sa.Column(
        "photo_type", _enum("phototype", "before", "during", "after", "issue", "drawing"), nullable=True,
    ))
    op.add_column("progress_attachments", sa.Column("work_type", sa.String(50), nullable=True))
    op.add_column("progress_attachments", sa.Column("tags", postgresql.ARRAY(sa.String(100)), nullable=True))
    op.add_column("progress_attachments", sa.Column("gps_latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("progress_attachments", sa.Column("gps_longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("progress_attachments", sa.Column("location_in_site", sa.String(100), nullable=True))
    op.add_column("progress_attachments", sa.Column("caption", sa.Text, nullable=True))
    op.add_column("progress_attachments", sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("progress_attachments", "taken_at")
    op.drop_column("progress_attachments", "caption")
    op.drop_column("progress_attachments", "location_in_site")
    op.drop_column("progress_attachments", "gps_longitude")
    op.drop_column("progress_attachments", "gps_latitude")
    op.drop_column("progress_attachments", "tags")
    op.drop_column("progress_attachments", "work_type")
    op.drop_column("progress_attachments", "photo_type")

    op.drop_table("project_comment_attachments")
    op.drop_table("project_comments")
    op.drop_table("vendor_deliveries")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("schedule_event_attendees")
    op.drop_table("schedule_events")
    op.execute("DROP VIEW IF EXISTS vendor_attendance_summary")
    op.drop_table("vendor_attendances")
    op.drop_table("daily_report_attachments")
    op.drop_table("daily_report_entries")
    op.drop_table("daily_reports")
    op.drop_table("project_tasks")
    op.drop_table("work_type_master")

    op.execute("DROP TYPE IF EXISTS deliverystatus")
    op.execute("DROP TYPE IF EXISTS purchaseorderstatus")
    op.execute("DROP TYPE IF EXISTS attendeeresponse")
    op.execute("DROP TYPE IF EXISTS schedulevisibility")
    op.execute("DROP TYPE IF EXISTS scheduleeventtype")
    op.execute("DROP TYPE IF EXISTS phototype")
    op.execute("DROP TYPE IF EXISTS weathertype")
    op.execute("DROP TYPE IF EXISTS taskdependencytype")
    op.execute("DROP TYPE IF EXISTS taskstatus")
