"""工事案件（工事台帳本体）モデル。"""
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import (
    AwardingType,
    ContractType,
    OrderType,
    PrevConstructionType,
    ProjectStatus,
)

if TYPE_CHECKING:
    from app.models.client import Client, ClientContact, ClientSite
    from app.models.comment import ProjectComment
    from app.models.gantt import ProjectTask
    from app.models.history import EditHistory
    from app.models.invoice import Invoice
    from app.models.ledger import LedgerApproval, ProjectLedgerMeta
    from app.models.order import Order
    from app.models.progress import ProgressLog
    from app.models.qcds import QCDS
    from app.models.quote import Quote
    from app.models.scan import ScanJob
    from app.models.user import User


class Project(Base, TimestampMixin):
    """工事案件（工事台帳の1行に相当）。"""

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 工期
    period_quote_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_quote_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_contract_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_contract_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_actual_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    period_actual_end: Mapped[date | None] = mapped_column(Date, nullable=True)

    # 案件属性
    order_type: Mapped[OrderType | None] = mapped_column(
        SAEnum(OrderType, name="ordertype"), nullable=True
    )
    contract_type: Mapped[ContractType | None] = mapped_column(
        SAEnum(ContractType, name="contracttype"), nullable=True
    )
    awarding_type: Mapped[AwardingType | None] = mapped_column(
        SAEnum(AwardingType, name="awardingtype"), nullable=True
    )
    payment_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    project_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 前回施工
    prev_construction_type: Mapped[PrevConstructionType | None] = mapped_column(
        SAEnum(PrevConstructionType, name="prevconstructiontype"), nullable=True
    )
    prev_construction_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prev_construction_other: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 客先担当
    client_contact_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    client_contact_person: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # 顧客マスタFK（移行完了まで NULL 許可）
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True
    )
    client_site_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_sites.id"), nullable=True
    )
    client_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_contacts.id"), nullable=True
    )

    # 担当者FK
    sales_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    construction_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # 金額・ステータス
    project_price: Mapped[float | None] = mapped_column(Numeric(12, 0), nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus, name="projectstatus"),
        nullable=False,
        default=ProjectStatus.quote,
    )

    # 論理削除
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    client: Mapped["Client | None"] = relationship("Client", back_populates="projects")
    client_site: Mapped["ClientSite | None"] = relationship("ClientSite", back_populates="projects")
    client_contact: Mapped["ClientContact | None"] = relationship(
        "ClientContact", back_populates="projects"
    )
    sales_person: Mapped["User | None"] = relationship(
        "User", foreign_keys=[sales_person_id], back_populates="sales_projects"
    )
    construction_person: Mapped["User | None"] = relationship(
        "User", foreign_keys=[construction_person_id], back_populates="construction_projects"
    )
    creator: Mapped["User"] = relationship(
        "User", foreign_keys=[created_by], back_populates="created_projects"
    )
    qcds: Mapped[list["QCDS"]] = relationship("QCDS", back_populates="project")
    quotes: Mapped[list["Quote"]] = relationship("Quote", back_populates="project")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="project")
    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="project")
    progress_logs: Mapped[list["ProgressLog"]] = relationship(
        "ProgressLog", back_populates="project"
    )
    scan_jobs: Mapped[list["ScanJob"]] = relationship("ScanJob", back_populates="project")
    edit_histories: Mapped[list["EditHistory"]] = relationship(
        "EditHistory", back_populates="project"
    )
    tasks: Mapped[list["ProjectTask"]] = relationship("ProjectTask", back_populates="project")
    comments: Mapped[list["ProjectComment"]] = relationship(
        "ProjectComment", back_populates="project"
    )
    ledger_meta: Mapped["ProjectLedgerMeta | None"] = relationship(
        "ProjectLedgerMeta", back_populates="project", uselist=False
    )
    ledger_approvals: Mapped[list["LedgerApproval"]] = relationship(
        "LedgerApproval", back_populates="project", order_by="LedgerApproval.display_order"
    )
