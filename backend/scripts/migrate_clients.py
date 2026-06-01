#!/usr/bin/env python3
"""既存 projects.client_name から clients マスタを構築する移行スクリプト。

使い方:
  # dry_run（変更なし、レポートのみ）
  python scripts/migrate_clients.py --dry-run

  # 本番実行
  python scripts/migrate_clients.py

平和堂店舗推定ロジック:
  project_name または project_location に「アル・プラザ」「平和堂」が含まれる場合、
  店舗名を抽出して client_sites に登録し projects.client_site_id を更新する。
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
import uuid
from collections import defaultdict
from datetime import datetime

# プロジェクトルートを sys.path に追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.client import Client, ClientSite
from app.models.project import Project


# ────────────────────────────────────────────────────────────────
# 平和堂店舗推定ロジック
# ────────────────────────────────────────────────────────────────

# 既知の平和堂ブランド
HEIWADO_BRANDS = ["平和堂", "アル・プラザ", "アルプラザ", "フレンドマート", "ビバシティ"]

def _detect_heiwado_brand(client_name: str | None) -> bool:
    """発注者名が平和堂グループかどうか判定。"""
    if not client_name:
        return False
    return any(b in client_name for b in HEIWADO_BRANDS)


def _extract_site_name(project_name: str, project_location: str | None) -> str | None:
    """案件名・現場住所から店舗名を推定する。

    例:「アル・プラザ アミ 空調改修」→「アル・プラザ アミ」
        「平和堂 鯖江店 電気設備更新」→「鯖江店」
    """
    text_sources = [project_name, project_location or ""]

    for src in text_sources:
        # 「アル・プラザ XX」「アルプラザ XX」パターン
        m = re.search(r"(アル[・.]?プラザ)\s*([^\s　]{2,10})", src)
        if m:
            return f"{m.group(1)} {m.group(2)}"

        # 「フレンドマート XX」パターン
        m = re.search(r"(フレンドマート)\s*([^\s　]{2,10})", src)
        if m:
            return f"{m.group(1)} {m.group(2)}"

        # 「平和堂 XX店」「平和堂XX店」パターン
        m = re.search(r"平和堂\s*([^\s　]{1,10}[店舗])", src)
        if m:
            return m.group(1)

        # 「XXX店」単体（平和堂案件の場合）
        m = re.search(r"([^\s　]{2,10}店)", src)
        if m:
            return m.group(1)

    return None


# ────────────────────────────────────────────────────────────────
# メイン処理
# ────────────────────────────────────────────────────────────────

async def run(dry_run: bool) -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL 環境変数が設定されていません", file=sys.stderr)
        sys.exit(1)

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. 全案件の client_name distinct を取得
        result = await session.execute(
            select(Project.client_name)
            .where(Project.client_name.isnot(None))
            .distinct()
        )
        distinct_names: list[str] = [r[0] for r in result.fetchall() if r[0] and r[0].strip()]

        print(f"\n{'='*60}")
        print(f"  migrate_clients.py  {'[DRY RUN]' if dry_run else '[LIVE RUN]'}")
        print(f"{'='*60}")
        print(f"  ユニーク発注者名: {len(distinct_names)} 件")
        print()

        # 2. 既存 clients レコードを取得（重複防止）
        existing_result = await session.execute(select(Client.client_name, Client.id))
        existing_map: dict[str, uuid.UUID] = {
            r[0]: r[1] for r in existing_result.fetchall()
        }

        # 3. clients テーブルに登録
        new_clients: dict[str, Client] = {}
        for name in distinct_names:
            if name in existing_map:
                print(f"  [SKIP]   既存顧客: {name}")
                continue
            client = Client(
                id=uuid.uuid4(),
                client_name=name,
                is_active=True,
            )
            new_clients[name] = client
            print(f"  [CREATE] 顧客: {name}")
            if not dry_run:
                session.add(client)

        if not dry_run:
            await session.flush()  # IDを確定させる

        # 4. 平和堂グループの案件 → 店舗推定
        heiwado_names = [n for n in distinct_names if _detect_heiwado_brand(n)]
        print(f"\n  平和堂グループ発注者: {len(heiwado_names)} 件")

        # 案件を取得して店舗推定
        proj_result = await session.execute(
            select(Project).where(
                Project.client_name.in_(heiwado_names),
                Project.deleted_at.is_(None),
            )
        )
        projects = proj_result.scalars().all()

        # client_name → site_name → [project_id] のマッピング
        site_map: dict[str, dict[str, list[uuid.UUID]]] = defaultdict(lambda: defaultdict(list))
        unresolved: list[tuple[str, str]] = []

        for proj in projects:
            site_name = _extract_site_name(proj.project_name, proj.project_location)
            if site_name:
                site_map[proj.client_name][site_name].append(proj.id)
            else:
                unresolved.append((proj.project_number, proj.project_name))

        print(f"\n  店舗推定結果:")
        total_sites = 0
        new_site_objs: dict[tuple[str, str], ClientSite] = {}

        for client_name, sites in site_map.items():
            client_id = existing_map.get(client_name) or (
                new_clients[client_name].id if client_name in new_clients else None
            )
            if client_id is None:
                continue
            for site_name, proj_ids in sites.items():
                total_sites += 1
                print(f"    [SITE] {client_name} / {site_name}  ({len(proj_ids)} 案件)")
                if not dry_run:
                    # 既存チェック
                    ex_site = await session.execute(
                        select(ClientSite).where(
                            ClientSite.client_id == client_id,
                            ClientSite.site_name == site_name,
                        )
                    )
                    existing_site = ex_site.scalar_one_or_none()
                    if existing_site:
                        site_obj = existing_site
                    else:
                        site_obj = ClientSite(
                            id=uuid.uuid4(),
                            client_id=client_id,
                            site_name=site_name,
                        )
                        session.add(site_obj)
                    new_site_objs[(client_name, site_name)] = site_obj

        if not dry_run:
            await session.flush()

        # 5. projects.client_id / client_site_id を更新
        updated_client = 0
        updated_site = 0

        for proj in projects:
            client_id = existing_map.get(proj.client_name) or (
                new_clients[proj.client_name].id if proj.client_name in new_clients else None
            )
            if client_id is None:
                continue
            if not dry_run and proj.client_id is None:
                proj.client_id = client_id
                updated_client += 1

            site_name = _extract_site_name(proj.project_name, proj.project_location)
            if site_name:
                key = (proj.client_name, site_name)
                site_obj = new_site_objs.get(key)
                if site_obj and not dry_run and proj.client_site_id is None:
                    proj.client_site_id = site_obj.id
                    updated_site += 1

        # 平和堂以外の案件も client_id を更新
        other_result = await session.execute(
            select(Project).where(
                Project.client_name.isnot(None),
                Project.client_name.not_in(heiwado_names),
                Project.deleted_at.is_(None),
            )
        )
        other_projects = other_result.scalars().all()
        for proj in other_projects:
            if not proj.client_name:
                continue
            client_id = existing_map.get(proj.client_name) or (
                new_clients[proj.client_name].id if proj.client_name in new_clients else None
            )
            if client_id and not dry_run and proj.client_id is None:
                proj.client_id = client_id
                updated_client += 1

        if not dry_run:
            await session.commit()

        # ────── レポート ──────
        print(f"\n{'='*60}")
        print(f"  レポート {'[DRY RUN - 変更なし]' if dry_run else '[完了]'}")
        print(f"{'='*60}")
        print(f"  新規顧客登録:    {len(new_clients)} 件")
        print(f"  新規店舗登録:    {total_sites} 件")
        if not dry_run:
            print(f"  案件client_id更新: {updated_client} 件")
            print(f"  案件site_id更新:   {updated_site} 件")

        if unresolved:
            print(f"\n  ⚠ 店舗を推定できなかった案件 ({len(unresolved)} 件):")
            for pn, pname in unresolved[:20]:
                print(f"    {pn}  {pname}")
            if len(unresolved) > 20:
                print(f"    ... 他 {len(unresolved)-20} 件")

        print()

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="clients マスタ移行スクリプト")
    parser.add_argument("--dry-run", action="store_true", help="変更を加えずにレポートのみ出力")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
