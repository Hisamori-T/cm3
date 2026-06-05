"""発注書 → QCDS 取決金額 自動連動サービス。"""
from __future__ import annotations

import uuid

from sqlalchemy import select, func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchase import PurchaseOrder
from app.models.qcds import QCDS, QCDSDirectWork
from app.models.vendor import Vendor
from app.models.enums import PurchaseOrderStatus


async def sync_agreed_amount_from_orders(
    db: AsyncSession,
    project_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> None:
    """指定案件・業者の発注書合計金額を QCDS の agreed_amount に反映する。

    - 発行済/一部納品/納品済のみ集計（下書きは除外）
    - vendor_id または vendor_name_snapshot のどちらかでマッチング
    """
    # 発注書合計（issued / partial_delivered / delivered）
    total_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        .where(
            PurchaseOrder.project_id == project_id,
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_([
                PurchaseOrderStatus.issued,
                PurchaseOrderStatus.partial_delivered,
                PurchaseOrderStatus.delivered,
            ]),
        )
    )
    total_amount = float(total_result.scalar() or 0)
    if total_amount == 0:
        return

    # 業者名（vendor_name_snapshot によるフォールバックマッチング用）
    vendor = await db.get(Vendor, vendor_id)
    vendor_name = vendor.vendor_name if vendor else None

    # QCDS の最新リビジョン
    qcds_result = await db.execute(
        select(QCDS.id)
        .where(QCDS.project_id == project_id)
        .order_by(QCDS.revision.desc())
        .limit(1)
    )
    qcds_id = qcds_result.scalar_one_or_none()
    if qcds_id is None:
        return

    # vendor_id または vendor_name_snapshot でマッチングして更新
    conditions = [
        QCDSDirectWork.qcds_id == qcds_id,
    ]
    if vendor_name:
        conditions.append(
            or_(
                QCDSDirectWork.vendor_id == vendor_id,
                QCDSDirectWork.vendor_name_snapshot.ilike(f"%{vendor_name}%"),
            )
        )
    else:
        conditions.append(QCDSDirectWork.vendor_id == vendor_id)

    await db.execute(
        update(QCDSDirectWork)
        .where(*conditions)
        .values(agreed_amount=total_amount)
    )
