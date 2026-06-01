"""大項目テンプレートモデル。"""
import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class SectionTemplate(Base, TimestampMixin):
    """見積書大項目のテンプレート（「仲都型」「改修型」等）。"""

    __tablename__ = "section_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    items: Mapped[list["SectionTemplateItem"]] = relationship(
        "SectionTemplateItem",
        back_populates="template",
        order_by="SectionTemplateItem.display_order",
        cascade="all, delete-orphan",
    )


class SectionTemplateItem(Base, TimestampMixin):
    """テンプレート内の大項目構成（A=建築工事、B=電気設備工事 等）。"""

    __tablename__ = "section_template_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("section_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    section_code: Mapped[str] = mapped_column(String(3), nullable=False)
    section_name: Mapped[str] = mapped_column(String(200), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    default_items: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    template: Mapped["SectionTemplate"] = relationship("SectionTemplate", back_populates="items")
