"""発注書 → QCDS 取決金額 自動連動サービス。"""
from __future__ import annotations

import uuid

from sqlalchemy import select, func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchase import PurchaseOrder
from app.models.qcds import QCDS, QCDSDirectWork
from app.models.vendor import Vendor
from app.models.enums import PurchaseOrderStatus

# 取決金額に加算する対象ステータス（下書き・キャンセル以外）
_SYNC_STATUSES = [
    PurchaseOrderStatus.issued,
    PurchaseOrderStatus.partial_delivered,
    PurchaseOrderStatus.delivered,
    PurchaseOrderStatus.completed,
]


async def sync_agreed_amount_from_orders(
    db: AsyncSession,
    project_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> None:
    """指定案件・業者の発注書合計金額を QCDS の agreed_amount に反映する。

    - 発行済/一部納品/納品済/完了のみ集計（下書きは除外）
    - vendor_id または vendor_name_snapshot のどちらかでマッチング
    - 合計が 0 の場合も agreed_amount を 0 にリセットする（発注書削除時対応）
    """
    # 発注書合計
    total_result = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        .where(
            PurchaseOrder.project_id == project_id,
            PurchaseOrder.vendor_id == vendor_id,
            PurchaseOrder.status.in_(_SYNC_STATUSES),
        )
    )
    total_amount = float(total_result.scalar() or 0)

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
    conditions = [QCDSDirectWork.qcds_id == qcds_id]
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


async def sync_all_vendors_from_orders(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> int:
    """案件内の全業者について発注書合計を QCDS に一括反映する。

    Returns:
        同期した業者数
    """
    # この案件の発注書に登録されている全 vendor_id を取得
    vendor_ids_result = await db.execute(
        select(PurchaseOrder.vendor_id)
        .where(
            PurchaseOrder.project_id == project_id,
            PurchaseOrder.vendor_id.isnot(None),
        )
        .distinct()
    )
    vendor_ids = [row[0] for row in vendor_ids_result.fetchall()]

    for vid in vendor_ids:
        await sync_agreed_amount_from_orders(db, project_id, vid)

    return len(vendor_ids)
