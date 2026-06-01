"""顧客マスタ・店舗・担当者モデル。"""
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum as SAEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import ClientRank

if TYPE_CHECKING:
    from app.models.project import Project


class Client(Base, TimestampMixin):
    """顧客マスタ。平和堂等の大手発注者を想定。"""

    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_code: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_name_kana: Mapped[str | None] = mapped_column(String(255), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    fax: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    representative: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_rank: Mapped[ClientRank | None] = mapped_column(
        SAEnum(ClientRank, name="clientrank"), nullable=True
    )
    payment_condition_default: Mapped[str | None] = mapped_column(Text, nullable=True)
    credit_limit: Mapped[float | None] = mapped_column(Numeric(14, 0), nullable=True)
    tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    sites: Mapped[list["ClientSite"]] = relationship(
        "ClientSite", back_populates="client", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["ClientContact"]] = relationship(
        "ClientContact", back_populates="client", cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="client")


class ClientSite(Base, TimestampMixin):
    """顧客の拠点・店舗マスタ。平和堂の各店舗に対応。"""

    __tablename__ = "client_sites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False
    )
    site_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    site_name: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    site_manager: Mapped[str | None] = mapped_column(String(100), nullable=True)
    site_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    client: Mapped["Client"] = relationship("Client", back_populates="sites")
    contacts: Mapped[list["ClientContact"]] = relationship(
        "ClientContact", back_populates="site"
    )
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="client_site")


class ClientContact(Base, TimestampMixin):
    """顧客の窓口担当者。"""

    __tablename__ = "client_contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False
    )
    client_site_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("client_sites.id"), nullable=True
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_kana: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # relationships
    client: Mapped["Client"] = relationship("Client", back_populates="contacts")
    site: Mapped["ClientSite | None"] = relationship("ClientSite", back_populates="contacts")
    projects: Mapped[list["Project"]] = relationship(
        "Project", back_populates="client_contact"
    )
