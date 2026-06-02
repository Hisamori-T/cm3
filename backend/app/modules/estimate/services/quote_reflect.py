"""Phase 1-A': 業者見積版からの反映エンドポイント（quotes.py に統合予定）。"""
# このファイルの内容は quotes.py の末尾に追記されます。
# quotes.py の router に直接登録するため、ここでは定義のみ記述します。

REFLECT_CODE = '''

# ---------------------------------------------------------------------------
# Phase 1-A': 業者見積版からの反映エンドポイント
# ---------------------------------------------------------------------------

class ReflectToQcdsRequest(BaseModel):
    version_id: uuid.UUID
    category: str  # "subcontract" | "material" | "other"

class ReflectToQcdsResponse(BaseModel):
    qcds_id: uuid.UUID
    row_no: int
    vendor_name: str | None
    budget_amount: float
    category: str

@router.post("/projects/{project_id}/qcds/reflect-from-version", response_model=ReflectToQcdsResponse)
async def reflect_version_to_qcds(
    project_id: uuid.UUID,
    body: ReflectToQcdsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReflectToQcdsResponse:
    from sqlalchemy import func as sa_func
    from app.models.enums import QCDSCategory
    from app.models.qcds import QCDS, QCDSDirectWork

    await _get_project_or_404(project_id, db)
    version = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.id == body.version_id)
    )).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="版が見つかりません")
    qcds = (await db.execute(select(QCDS).where(QCDS.project_id == project_id))).scalar_one_or_none()
    if qcds is None:
        raise HTTPException(status_code=404, detail="QCDSが見つかりません")
    try:
        cat = QCDSCategory(body.category)
    except ValueError:
        raise HTTPException(status_code=400, detail="category は subcontract / material / other のいずれか")
    total = sum(float(i.amount or 0) for i in version.items)
    max_row = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QCDSDirectWork.row_no), 0))
        .where(QCDSDirectWork.qcds_id == qcds.id)
    )).scalar_one()
    db.add(QCDSDirectWork(
        qcds_id=qcds.id, row_no=max_row + 1,
        work_type=version.vendor_name_snapshot or "スキャン取込",
        vendor_id=version.vendor_id, vendor_name_snapshot=version.vendor_name_snapshot,
        budget_amount=total, category=cat,
    ))
    await db.commit()
    logger.info("version_reflected_to_qcds", version_id=str(body.version_id), total=total)
    return ReflectToQcdsResponse(qcds_id=qcds.id, row_no=max_row + 1,
        vendor_name=version.vendor_name_snapshot, budget_amount=total, category=body.category)


class ReflectToQuoteRequest(BaseModel):
    version_id: uuid.UUID
    markup_rate: float = 1.0
    section_type: str  # "new" | "existing"
    section_name: str | None = None
    section_id: uuid.UUID | None = None

class ReflectToQuoteResponse(BaseModel):
    quote_id: uuid.UUID
    section_id: uuid.UUID
    added_item_count: int

@router.post("/projects/{project_id}/quotes/{quote_id}/reflect-from-version", response_model=ReflectToQuoteResponse)
async def reflect_version_to_quote(
    project_id: uuid.UUID,
    quote_id: uuid.UUID,
    body: ReflectToQuoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReflectToQuoteResponse:
    await _get_project_or_404(project_id, db)
    quote = (await db.execute(
        select(Quote).where(Quote.id == quote_id, Quote.project_id == project_id)
    )).scalar_one_or_none()
    if quote is None:
        raise HTTPException(status_code=404, detail="見積書が見つかりません")
    version = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.id == body.version_id)
    )).scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="版が見つかりません")

    if body.section_type == "new":
        if not body.section_name:
            raise HTTPException(status_code=400, detail="新規大項目の名前を入力してください")
        max_row = (await db.execute(
            select(func.coalesce(func.max(QuoteSection.row_no), 0)).where(QuoteSection.quote_id == quote_id)
        )).scalar_one()
        used = {s.section_letter for s in (await db.execute(
            select(QuoteSection).where(QuoteSection.quote_id == quote_id)
        )).scalars().all()}
        letter = next((chr(ord("A") + i) for i in range(26) if chr(ord("A") + i) not in used), "Z")
        sec = QuoteSection(quote_id=quote_id, section_letter=letter,
                           section_name=body.section_name, row_no=max_row + 1)
        db.add(sec)
        await db.flush()
        target_section_id = sec.id
    else:
        if body.section_id is None:
            raise HTTPException(status_code=400, detail="既存大項目のIDを指定してください")
        ex = (await db.execute(select(QuoteSection).where(
            QuoteSection.id == body.section_id, QuoteSection.quote_id == quote_id
        ))).scalar_one_or_none()
        if ex is None:
            raise HTTPException(status_code=404, detail="指定した大項目が見つかりません")
        target_section_id = body.section_id

    max_item_row = (await db.execute(
        select(func.coalesce(func.max(QuoteItem.row_no), 0))
        .where(QuoteItem.quote_id == quote_id, QuoteItem.version_id.is_(None))
    )).scalar_one()

    items_sorted = sorted(version.items, key=lambda x: x.row_no)
    markup = body.markup_rate
    for i, vi in enumerate(items_sorted):
        cost = float(vi.unit_price or 0)
        up = round(cost * markup) if cost else None
        qty = float(vi.quantity) if vi.quantity is not None else None
        amt = round(up * qty) if (up and qty) else None
        db.add(QuoteItem(
            quote_id=quote_id, section_id=target_section_id,
            row_no=max_item_row + i + 1,
            item_name=vi.item_name, spec=vi.spec, unit=vi.unit, quantity=vi.quantity,
            cost_price=vi.unit_price, unit_price=up, amount=amt,
            source_vendor_id=version.vendor_id, source_type="scan",
        ))

    await db.flush()
    all_items = (await db.execute(
        select(QuoteItem).where(QuoteItem.quote_id == quote_id, QuoteItem.version_id.is_(None))
    )).scalars().all()
    s, t, tot = _calc_totals(list(all_items))
    quote.subtotal = s; quote.tax_amount = t; quote.total_amount = tot
    await db.commit()
    logger.info("version_reflected_to_quote", version_id=str(body.version_id), count=len(items_sorted))
    return ReflectToQuoteResponse(quote_id=quote_id, section_id=target_section_id, added_item_count=len(items_sorted))


class CreateVersionFromVendorRequest(BaseModel):
    vendor_id: uuid.UUID
    source_project_id: uuid.UUID

class CreateVersionFromVendorResponse(BaseModel):
    version_id: uuid.UUID
    version_no: int
    vendor_name_snapshot: str | None
    item_count: int

@router.post("/projects/{project_id}/quote-versions/create-from-vendor", response_model=CreateVersionFromVendorResponse)
async def create_version_from_vendor(
    project_id: uuid.UUID,
    body: CreateVersionFromVendorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CreateVersionFromVendorResponse:
    from sqlalchemy import func as sa_func

    await _get_project_or_404(project_id, db)
    quotes = (await db.execute(select(Quote).where(Quote.project_id == project_id))).scalars().all()
    if not quotes:
        quote = Quote(project_id=project_id); db.add(quote); await db.flush()
    else:
        quote = quotes[0]

    src_quotes = (await db.execute(
        select(Quote).where(Quote.project_id == body.source_project_id)
    )).scalars().all()
    if not src_quotes:
        raise HTTPException(status_code=404, detail="参照元案件に見積書がありません")

    src_ver = (await db.execute(
        select(QuoteVersion).options(selectinload(QuoteVersion.items))
        .where(QuoteVersion.quote_id.in_([q.id for q in src_quotes]),
               QuoteVersion.vendor_id == body.vendor_id)
        .order_by(QuoteVersion.version_no.desc())
    )).scalars().first()
    if src_ver is None:
        raise HTTPException(status_code=404, detail="参照元案件にその業者の版がありません")

    from app.models.vendor import Vendor
    vendor = await db.get(Vendor, body.vendor_id)
    vendor_name = vendor.vendor_name if vendor else src_ver.vendor_name_snapshot

    max_vno = (await db.execute(
        select(sa_func.coalesce(sa_func.max(QuoteVersion.version_no), 0))
        .where(QuoteVersion.quote_id == quote.id)
    )).scalar_one()

    new_ver = QuoteVersion(id=uuid.uuid4(), quote_id=quote.id, version_no=max_vno + 1,
                           vendor_id=body.vendor_id, vendor_name_snapshot=vendor_name,
                           markup_rate=src_ver.markup_rate)
    db.add(new_ver)
    await db.flush()

    for item in sorted(src_ver.items, key=lambda x: x.row_no):
        db.add(QuoteItem(
            quote_id=quote.id, version_id=new_ver.id, row_no=item.row_no,
            item_name=item.item_name, spec=item.spec, unit=item.unit,
            quantity=item.quantity, unit_price=item.unit_price,
            cost_price=item.cost_price, amount=item.amount,
            source_vendor_id=body.vendor_id, source_type="import",
        ))

    await db.commit()
    logger.info("version_created_from_vendor", vendor_id=str(body.vendor_id), version_id=str(new_ver.id))
    return CreateVersionFromVendorResponse(
        version_id=new_ver.id, version_no=new_ver.version_no,
        vendor_name_snapshot=new_ver.vendor_name_snapshot, item_count=len(src_ver.items),
    )
'''
