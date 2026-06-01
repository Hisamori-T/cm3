"""工事番号自動採番サービス。{西暦下2桁}-{社員番号}-{連番3桁} 形式。"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import ProjectNumberSequence


async def generate_project_number(
    employee_number: int,
    project_date: date,
    session: AsyncSession,
) -> str:
    """採番管理テーブルを SELECT FOR UPDATE してシーケンスをインクリメントする。

    同一年・同一社員番号で並行リクエストが来ても重複しないよう行ロックを取る。
    """
    year_yy = project_date.year % 100

    result = await session.execute(
        select(ProjectNumberSequence)
        .where(
            ProjectNumberSequence.year_yy == year_yy,
            ProjectNumberSequence.employee_number == employee_number,
        )
        .with_for_update()
    )
    seq_row = result.scalar_one_or_none()

    if seq_row is None:
        seq_row = ProjectNumberSequence(
            year_yy=year_yy, employee_number=employee_number, last_seq=0
        )
        session.add(seq_row)
        await session.flush()

    seq_row.last_seq += 1
    await session.flush()

    return f"{year_yy:02d}-{employee_number}-{seq_row.last_seq:03d}"
