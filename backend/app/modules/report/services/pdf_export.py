"""WeasyPrint による PDF 帳票生成サービス。"""
from __future__ import annotations

import base64
import html
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

_HERE = Path(__file__).parent
# _HERE = modules/report/services → .parent×3 = app → templates/images/clap_logo.png
_LOGO_PATH = _HERE.parent.parent.parent / "templates" / "images" / "clap_logo.png"


def _logo_data_url() -> str:
    """ロゴ画像を base64 データ URL に変換する（ファイルが存在しない場合は空文字）。"""
    if _LOGO_PATH.exists():
        data = _LOGO_PATH.read_bytes()
        b64 = base64.b64encode(data).decode()
        return f"data:image/png;base64,{b64}"
    return ""


# ── データクラス ──────────────────────────────────────────────────────────────

@dataclass
class CompanyInfo:
    name: str = "株式会社クラップ"
    name_en: str = "CLAP CORPORATION"
    postal_code: str = "913-0043"
    address: str = "福井県坂井市三国町錦3-4-2"
    tel: str = "0776-81-8330"
    fax: str = "0776-81-8331"
    representative: str = "奴間 正人"
    tax_reg_no: str = "T5210001007332"
    bank_name: str = "福井銀行"
    bank_branch: str = "経田支店"
    bank_account_type: str = "普通"
    bank_account_number: str = "1068586"
    bank_account_holder: str = "株式会社クラップ"


# ── ユーティリティ ─────────────────────────────────────────────────────────────

def _fmt_yen(v: Any) -> str:
    if v is None:
        return "―"
    try:
        return f"¥{int(v):,}"
    except (TypeError, ValueError):
        return str(v)


def _fmt_date(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (date, datetime)):
        return v.strftime("%Y年%m月%d日")
    try:
        return str(v)[:10].replace("-", "/")
    except Exception:
        return str(v)


def _fmt_date_jp(v: Any) -> str:
    """和暦スタイル: 2026 年 5 月 29 日（スペース区切り）。"""
    if v is None:
        return ""
    if isinstance(v, (date, datetime)):
        return f"{v.year} 年 {v.month} 月 {v.day} 日"
    try:
        s = str(v)[:10]
        y, m, d = s.split("-")
        return f"{y} 年 {int(m)} 月 {int(d)} 日"
    except Exception:
        return str(v)


def _h(s: Any) -> str:
    """HTML エスケープ。"""
    return html.escape(str(s or ""), quote=True)


# ── 見積書表紙 CSS（Gemini生成テンプレートベース）────────────────────────────

_QUOTE_COVER_CSS_GEMINI = """
@page {
    size: A4 landscape;
    margin: 12mm 15mm;
    background-color: #ffffff;
}
* { box-sizing: border-box; }
body {
    font-family: 'Noto Sans CJK JP', 'Noto Serif JP', 'Helvetica Neue', Arial, sans-serif;
    color: #000000; margin: 0; padding: 0; font-size: 11pt; line-height: 1.6;
}
.meta-header { text-align: right; font-size: 10pt; margin-bottom: 5mm; }
.meta-table { margin-left: auto; border-collapse: collapse; }
.meta-table td { padding: 2px 5px; }
.meta-table .label { text-align: right; }
.meta-table .value { text-align: left; padding-left: 15px; }
.title-container { text-align: center; margin-bottom: 25mm; }
.title { font-size: 22pt; font-weight: bold; letter-spacing: 15px; margin: 0; padding-bottom: 5px; }
.title-line { border-top: 2px solid #000000; width: 100%; margin: 0 auto; }
.main-content { display: table; width: 100%; table-layout: fixed; }
.column-left { display: table-cell; width: 62%; vertical-align: top; padding-right: 25px; }
.column-right { display: table-cell; width: 38%; vertical-align: top; padding-left: 15px; }
.client-name { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 2px; margin-bottom: 5pt; }
.client-name .suffix { float: right; font-size: 12pt; font-weight: normal; }
.greeting-text { font-size: 10pt; margin-bottom: 20pt; line-height: 1.4; }
.amount-row { border-bottom: 2px solid #000000; padding-bottom: 4px; margin-bottom: 3pt; font-size: 13pt; font-weight: bold; }
.amount-value { font-size: 15pt; float: right; letter-spacing: 1px; }
.tax-note { font-size: 9.5pt; margin-bottom: 20pt; padding-left: 2px; }
.condition-table { width: 100%; border-collapse: collapse; }
.condition-table td { padding: 6pt 0 3pt 0; vertical-align: top; }
.condition-table tr { border-bottom: 1px solid #000000; }
.condition-label { font-weight: bold; width: 120pt; letter-spacing: 2px; }
.condition-label-wide { font-weight: bold; width: 120pt; }
.condition-table tr.no-border { border-bottom: none; }
.remarks-content { line-height: 1.5; }
.company-container { padding-left: 20px; }
.company-header-row {
    display: flex; flex-direction: row; align-items: flex-start;
    gap: 14pt; margin-bottom: 12pt;
}
.company-logo-area { flex-shrink: 0; }
.company-info { flex: 1; }
.company-name-big { font-size: 16pt; font-weight: bold; margin-bottom: 4pt; }
.company-details { font-size: 9pt; line-height: 1.4; margin-bottom: 15mm; }
.stamp-table-wrapper { width: 100%; text-align: right; margin-bottom: 15mm; }
.stamp-table { border-collapse: collapse; margin-left: auto; }
.stamp-table th {
    border: 1px solid #000000; width: 50pt; font-size: 9pt;
    font-weight: normal; text-align: center; padding: 2px 0; background-color: #ffffff;
}
.stamp-table td {
    border: 1px solid #000000; height: 50pt; width: 50pt;
    text-align: center; vertical-align: middle;
}
.stamp-circle {
    border: 1.5px solid #C00000; border-radius: 50%;
    width: 38pt; height: 38pt; margin: auto;
    color: #C00000; font-size: 11pt; font-weight: bold;
    writing-mode: vertical-rl; text-orientation: upright;
    display: flex; align-items: center; justify-content: center;
    letter-spacing: 0;
}
.contact-box { font-size: 9.5pt; line-height: 1.5; padding-left: 5px; }
.contact-box .title-msg { margin-bottom: 10pt; }
.contact-info-table { width: 100%; border-collapse: collapse; margin-top: 5pt; }
.contact-info-table td { padding: 4pt 0; vertical-align: top; }
.contact-info-label { width: 50pt; }
.contact-info-value { font-weight: bold; }
"""

# ── 共通 CSS ──────────────────────────────────────────────────────────────────

_BASE_CSS = """
@page {
  size: A4 portrait;
  margin: 18mm 15mm 22mm 15mm;
  @bottom-center {
    content: "株式会社クラップ　P-" counter(page);
    font-size: 7.5pt;
    font-family: sans-serif;
    color: #555;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Noto Serif JP', 'Noto Sans CJK JP', 'IPAMincho', serif;
  font-size: 9pt;
  color: #111;
  line-height: 1.5;
}

table { width: 100%; border-collapse: collapse; }
th, td { border: 0.5pt solid #888; padding: 2pt 4pt; }
th { background: #1F4E79; color: #fff; font-weight: bold; text-align: center; font-size: 8pt; }
td { vertical-align: middle; }

.right { text-align: right; }
.center { text-align: center; }
.bold { font-weight: bold; }
.red { color: #C00000; }
.small { font-size: 7.5pt; }
.muted { color: #666; }

.section-header td { background: #BDD7EE; font-weight: bold; }
.subtotal-row td { background: #f0f4fa; font-weight: bold; }
.total-row td { background: #1F4E79; color: #fff; font-weight: bold; font-size: 10pt; }
.tax-row td { background: #dce6f1; }

.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }

.clause { margin: 3pt 0; font-size: 8pt; line-height: 1.6; }
.clause-title { font-weight: bold; }
"""

# ── 内訳書 CSS（横向きA4・Geminiテンプレート準拠）────────────────────────────

_BREAKDOWN_CSS = """
@page {
    size: A4 landscape;
    margin: 15mm 20mm;
    @bottom-center {
        content: "株式会社クラップ";
        font-size: 10pt;
        font-family: 'Noto Sans CJK JP', sans-serif;
    }
    @bottom-right {
        content: "P － " counter(page);
        font-size: 10pt;
        font-family: 'Noto Sans CJK JP', sans-serif;
    }
}
* { box-sizing: border-box; }
body {
    font-family: 'Noto Sans CJK JP', 'Noto Serif JP', sans-serif;
    font-size: 10pt; color: #000; margin: 0; padding: 0;
}
.page-break { page-break-before: always; }
table.grid-table {
    width: 100%; border-collapse: collapse;
    table-layout: fixed; margin: 0 auto;
}
table.grid-table th, table.grid-table td {
    border: 1px solid #000; height: 28px;
    vertical-align: middle; padding: 0 6px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
table.grid-table th {
    text-align: center; font-weight: normal;
    letter-spacing: 2px; background-color: #ffffff;
}
.col-code   { width: 4%; }
.col-name   { width: 25%; }
.col-spec   { width: 25%; }
.col-unit   { width: 5%;  text-align: center; }
.col-qty    { width: 6%;  text-align: right; }
.col-price  { width: 10%; text-align: right; }
.col-amount { width: 12%; text-align: right; }
.col-remark { width: 13%; text-align: left; }
.align-center { text-align: center; }
.align-right  { text-align: right; }
.align-left   { text-align: left; }
.total-row td { height: 30px; }
.total-label  { text-align: center; letter-spacing: 5px; }
"""


def _fmt_num(v: Any) -> str:
    """カンマ区切り整数（金額用）。"""
    if v is None or v == 0:
        return ""
    try:
        return f"{int(v):,}"
    except (TypeError, ValueError):
        return str(v)


def _fmt_qty(v: Any) -> str:
    """数量フォーマット（小数点1桁）。"""
    if v is None:
        return ""
    try:
        f = float(v)
        return f"{f:.1f}" if f != int(f) else f"{int(f)}"
    except (TypeError, ValueError):
        return str(v)


def _render_breakdown_html(quote: Any, items: list, sections: list, co: CompanyInfo) -> str:
    """総括表（P2）+ 大項目別明細（P3〜）の HTML を生成する。"""
    subtotal = quote.subtotal or 0
    tax = quote.tax_amount or 0
    discount = quote.discount_amount or 0
    total = quote.total_amount or 0

    # 大項目別にアイテムをグループ化
    section_map: dict[str, list] = {}
    unsectioned: list = []
    for sec in sorted(sections, key=lambda s: s.row_no):
        section_map[str(sec.id)] = []
    for item in sorted(items, key=lambda i: i.row_no):
        # version_id がある行（業者見積取込行）は顧客見積集計から除外
        if getattr(item, "version_id", None):
            continue
        sid = str(getattr(item, "section_id", None) or "")
        if sid in section_map:
            section_map[sid].append(item)
        else:
            unsectioned.append(item)

    sorted_sections = sorted(sections, key=lambda s: s.row_no)

    # ── P2: 総括表 ──────────────────────────────────────────────────────────
    summary_rows = ""
    for sec in sorted_sections:
        sec_items = section_map[str(sec.id)]
        sec_total = sum((i.amount or 0) for i in sec_items)
        summary_rows += f"""
        <tr>
            <td class="align-center">{_h(sec.section_letter)}</td>
            <td class="align-left">{_h(sec.section_name)}</td>
            <td class="align-left"></td>
            <td class="align-center">式</td>
            <td class="align-right">1</td>
            <td class="align-right"></td>
            <td class="align-right">{_fmt_num(sec_total)}</td>
            <td class="align-left"></td>
        </tr>"""

    # 空白行（大項目数に応じて調整）
    blank_count = max(2, 15 - len(sorted_sections))
    blank_rows = "".join(
        "<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>"
        for _ in range(blank_count)
    )

    discount_row = ""
    if discount:
        discount_row = f"""
        <tr class="total-row">
            <td colspan="6" class="total-label">出精値引き</td>
            <td class="align-right">{_fmt_num(-abs(discount))}</td>
            <td></td>
        </tr>"""

    summary_html = f"""
    <table class="grid-table">
        <thead>
            <tr>
                <th class="col-code"></th>
                <th class="col-name">名　　　　称</th>
                <th class="col-spec">仕　　　　様</th>
                <th class="col-unit">単位</th>
                <th class="col-qty">数 量</th>
                <th class="col-price">単　　価</th>
                <th class="col-amount">金　　額</th>
                <th class="col-remark">摘　　要</th>
            </tr>
        </thead>
        <tbody>
            {summary_rows}
            {blank_rows}
            {discount_row}
            <tr class="total-row">
                <td colspan="6" class="total-label">計</td>
                <td class="align-right">{_fmt_num(subtotal - (discount or 0))}</td>
                <td></td>
            </tr>
            <tr class="total-row">
                <td colspan="6" class="total-label">消費税</td>
                <td class="align-right">{_fmt_num(tax)}</td>
                <td></td>
            </tr>
            <tr class="total-row">
                <td colspan="6" class="total-label">合 計</td>
                <td class="align-right">{_fmt_num(total)}</td>
                <td></td>
            </tr>
        </tbody>
    </table>"""

    # ── P3〜: 大項目別明細 ────────────────────────────────────────────────────
    detail_pages = ""
    for sec in sorted_sections:
        sec_items = section_map[str(sec.id)]
        sec_total = sum((i.amount or 0) for i in sec_items)

        item_rows = ""
        for item in sec_items:
            price_str = _fmt_num(item.unit_price) if item.unit_price else ""
            item_rows += f"""
            <tr>
                <td></td>
                <td class="align-left">　{_h(item.item_name)}</td>
                <td class="align-left">{_h(item.spec or '')}</td>
                <td class="align-center">{_h(item.unit or '')}</td>
                <td class="align-right">{_fmt_qty(item.quantity)}</td>
                <td class="align-right">{price_str}</td>
                <td class="align-right">{_fmt_num(item.amount)}</td>
                <td class="align-left">{_h(item.remarks or '')}</td>
            </tr>"""

        # 空白行
        blank_count_d = max(2, 20 - len(sec_items))
        blank_rows_d = "".join(
            "<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>"
            for _ in range(blank_count_d)
        )

        detail_pages += f"""
    <div class="page-break"></div>
    <table class="grid-table">
        <thead>
            <tr>
                <th class="col-code"></th>
                <th class="col-name">名　　　　称</th>
                <th class="col-spec">仕　　　　様</th>
                <th class="col-unit">単位</th>
                <th class="col-qty">数 量</th>
                <th class="col-price">単　　価</th>
                <th class="col-amount">金　　額</th>
                <th class="col-remark">摘　　要</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="align-center">{_h(sec.section_letter)}</td>
                <td class="align-left">{_h(sec.section_name)}</td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
            {item_rows}
            {blank_rows_d}
            <tr class="total-row">
                <td colspan="3"></td>
                <td colspan="3" class="total-label">小　計</td>
                <td class="align-right">{_fmt_num(sec_total)}</td>
                <td></td>
            </tr>
        </tbody>
    </table>"""

    return f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>内訳書</title>
<style>{_BREAKDOWN_CSS}</style>
</head>
<body>
{summary_html}
{detail_pages}
</body></html>"""


# ── 見積条件書 PDF ────────────────────────────────────────────────────────────

def generate_condition_pdf(
    project_name: str,
    period_start: str | None,
    period_end: str | None,
    payment_condition: str | None,
    condition_text: str,
    company: CompanyInfo,
) -> bytes:
    """見積条件書 PDF（A4縦）を生成する。"""
    import weasyprint

    logo_url = _logo_data_url()
    if logo_url:
        logo_html = f'<img src="{logo_url}" style="height:32pt;display:block;margin-bottom:4pt;" alt="CLAP">'
    else:
        logo_html = """<div style="font-family:Arial Black,sans-serif;font-size:20pt;font-weight:900;color:#0a194f;">CLAP</div>
        <div style="font-family:Arial,sans-serif;font-size:6pt;font-weight:bold;color:#0a194f;letter-spacing:2px;border-top:1.5px solid #0a194f;">CORPORATION</div>"""

    period_str = ""
    if period_start and period_end:
        period_str = f"{period_start} ～ {period_end}"
    elif period_start:
        period_str = f"{period_start} ～"
    elif period_end:
        period_str = f"～ {period_end}"

    payment_str = _h(payment_condition or "御協議の上")
    condition_html = _h(condition_text).replace("\n", "<br>") if condition_text else ""

    css = """
@page { size: A4 portrait; margin: 18mm 18mm 18mm 18mm; }
body { font-family: "Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif; font-size: 10pt; color: #111; }
.title { font-size: 18pt; font-weight: bold; text-align: center; letter-spacing: 0.15em; margin: 0 0 16pt; }
.header-table { width: 100%; border-collapse: collapse; margin-bottom: 16pt; font-size: 10pt; }
.header-table td { padding: 5pt 8pt; border: 0.5pt solid #888; }
.header-table .lbl { background: #f0f0f0; font-weight: bold; width: 28%; }
.condition-body { font-size: 9.5pt; line-height: 1.8; white-space: pre-wrap; }
.footer { position: fixed; bottom: 0; right: 0; font-size: 7pt; color: #888; }
.company-block { text-align: right; margin-bottom: 12pt; }
"""

    html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>見積条件書</title>
<style>{css}</style></head><body>
<div class="company-block">
  {logo_html}
  <div style="font-size:9pt;color:#333;">{_h(company.name)}</div>
</div>
<div class="title">見 積 条 件 書</div>
<table class="header-table">
  <tr><td class="lbl">工 事 件 名</td><td>{_h(project_name)}</td></tr>
  <tr><td class="lbl">工　　　期</td><td>{_h(period_str) if period_str else "　"}</td></tr>
  <tr><td class="lbl">御支払条件</td><td>{payment_str}</td></tr>
</table>
<div class="condition-body">{condition_html}</div>
<div class="footer">{_h(company.name)} &nbsp; 以上</div>
</body></html>"""

    return weasyprint.HTML(string=html).write_pdf()


# ── 見積書 PDF ────────────────────────────────────────────────────────────────

def generate_quote_pdf(quote: Any, project: Any, items: list, sections: list,
                       company: CompanyInfo, stamp_users: dict[str, str] | None = None) -> bytes:
    """見積書（P1:表紙 + P2:総括表 + P3〜:大項目別明細）PDF を生成する。"""
    import io
    import weasyprint
    from pypdf import PdfWriter, PdfReader

    stamp_users = stamp_users or {}

    # P1: 表紙（横向き）
    cover_html, _ = _render_quote_html(quote, project, items, sections, company, stamp_users)
    cover_pdf = weasyprint.HTML(string=cover_html).write_pdf()

    # P2〜: 総括表 + 大項目別明細（横向き、1つのHTML）
    breakdown_html = _render_breakdown_html(quote, items, sections, company)
    breakdown_pdf = weasyprint.HTML(string=breakdown_html).write_pdf()

    # 全ページをマージ
    writer = PdfWriter()
    for data in [cover_pdf, breakdown_pdf]:
        reader = PdfReader(io.BytesIO(data))
        for page in reader.pages:
            writer.add_page(page)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _render_quote_html(quote: Any, project: Any, items: list, sections: list,
                       co: CompanyInfo, stamp_users: dict[str, str]) -> tuple[str, str]:
    # ── データ準備 ────────────────────────────────────────────────────────────
    subtotal = quote.subtotal or 0
    tax = quote.tax_amount or 0
    discount = quote.discount_amount or 0
    total = quote.total_amount or 0
    client_name = getattr(project, "client_name", "") or ""
    quote_number = getattr(quote, "quote_number", "") or ""
    project_number = getattr(project, "project_number", "") or ""
    issued_at_raw = getattr(quote, "issued_at", None) or getattr(quote, "created_at", None)

    # 日付: 「2026年」「3月10日」の2行表示
    if issued_at_raw:
        if isinstance(issued_at_raw, (date, datetime)):
            year_str = f"{issued_at_raw.year}年"
            md_str = f"{issued_at_raw.month}月{issued_at_raw.day}日"
        else:
            try:
                parts = str(issued_at_raw)[:10].split("-")
                year_str = f"{parts[0]}年"
                md_str = f"{int(parts[1])}月{int(parts[2])}日"
            except Exception:
                year_str = str(issued_at_raw)
                md_str = ""
    else:
        year_str = ""
        md_str = ""

    # ── ロゴ（base64埋め込み）────────────────────────────────────────────────
    logo_url = _logo_data_url()
    if logo_url:
        logo_html = f'<img src="{logo_url}" style="height:40pt; display:block;" alt="CLAP">'
    else:
        # フォールバック：テキストロゴ
        logo_html = """
        <div style="font-family:Arial Black,sans-serif;font-size:26pt;font-weight:900;color:#0a194f;line-height:1;letter-spacing:-1px;">CLAP</div>
        <div style="font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#0a194f;letter-spacing:2.5px;border-top:2px solid #0a194f;width:110pt;">CORPORATION</div>"""

    # ── 承認スタンプ（承認→審査→担当）──────────────────────────────────────
    def _stamp_td(uid: Any, at: Any) -> str:
        key = str(uid) if uid else ""
        # stamp_users には stamp_text 優先の値が入っている（exports.py で解決済み）
        stamp_val = stamp_users.get(key, "") if key else ""
        if stamp_val and at:
            return f'<td><div class="stamp-circle">{_h(stamp_val)}</div></td>'
        return "<td></td>"

    stamp_td_approver  = _stamp_td(getattr(quote, "approver_id", None),         getattr(quote, "approved_at", None))
    stamp_td_reviewer  = _stamp_td(getattr(quote, "reviewer_id", None),          getattr(quote, "reviewed_at", None))
    stamp_td_pic       = _stamp_td(getattr(quote, "person_in_charge_id", None),  getattr(quote, "person_in_charge_confirmed_at", None))

    # ── 担当者（person_in_charge の氏名を担当者として表示）──────────────────
    pic_id = str(getattr(quote, "person_in_charge_id", None) or "")
    pic_name = stamp_users.get(pic_id, "") if pic_id else ""

    # ── 工期 ──────────────────────────────────────────────────────────────────
    period_start = _fmt_date(getattr(project, "period_start", None))
    period_end   = _fmt_date(getattr(project, "period_end", None))
    period_str   = f"{period_start} 〜 {period_end}" if (period_start or period_end) else "ご協議の上"

    # ── 有効期限 ──────────────────────────────────────────────────────────────
    valid_until_raw = getattr(quote, "valid_until", None)
    valid_until_str = _fmt_date(valid_until_raw) if valid_until_raw else ""

    # ── 備考 ──────────────────────────────────────────────────────────────────
    remarks_raw = getattr(quote, "remarks", "") or ""
    # 改行を <br> に変換。「：」と本文を flex で横並びにして2行目以降の字下げを揃える
    if remarks_raw:
        remarks_lines = _h(remarks_raw).replace("\n", "<br>")
        remarks_html = (
            '<div style="display:flex;align-items:flex-start;line-height:1.5;">'
            '<span style="flex-shrink:0;white-space:nowrap;">：&nbsp;</span>'
            f'<span style="flex:1;">{remarks_lines}</span>'
            '</div>'
        )
    else:
        remarks_html = ""

    # ── 担当者連絡先ブロック ──────────────────────────────────────────────────
    pic_phone = stamp_users.get(pic_id + "_phone", "") if pic_id else ""
    contact_block = ""
    if pic_name:
        phone_row = (
            f'<tr><td class="contact-info-label">連絡先：</td>'
            f'<td class="contact-info-value">{_h(pic_phone)}</td></tr>'
            if pic_phone else ""
        )
        contact_block = f"""
        <div class="contact-box">
            <div class="title-msg">この見積書についてのご用命、お問い合わせは<br>下記担当者へ連絡をお願いします。</div>
            <table class="contact-info-table">
                <tr>
                    <td class="contact-info-label">担当者：</td>
                    <td class="contact-info-value">{_h(pic_name)}</td>
                </tr>
                {phone_row}
            </table>
        </div>"""

    # ── 表紙 HTML（Geminiテンプレート構造）────────────────────────────────────
    cover_html = f"""<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>御見積書</title>
<style>{_QUOTE_COVER_CSS_GEMINI}</style>
</head>
<body>

    <div class="meta-header">
        <table class="meta-table">
            <tr>
                <td class="label">弊社工事番号：</td>
                <td class="value">{_h(project_number)}</td>
            </tr>
            <tr>
                <td class="label">{_h(year_str)}</td>
                <td class="value">{_h(md_str)}</td>
            </tr>
        </table>
    </div>

    <div class="title-container">
        <h1 class="title">御見積書</h1>
        <div class="title-line"></div>
    </div>

    <div class="main-content">
        <div class="column-left">
            <div class="client-name">
                {_h(client_name)}
                <span class="suffix">御中</span>
            </div>
            <div class="greeting-text">
                下記の通り御見積申し上げます。<br>
                何卒ご用命のほどお願い申し上げます。
            </div>

            <div class="amount-row">
                <span class="amount-label">御 見 積 金 額 ：</span>
                <span class="amount-value">{_fmt_yen(total)} -</span>
            </div>
            <div class="tax-note">上記金額には、消費税10%を含んでおります。</div>

            <table class="condition-table">
                <tr>
                    <td class="condition-label">工 事 名 称</td>
                    <td>： {_h(project.project_name)}</td>
                </tr>
                <tr>
                    <td class="condition-label">工 事 場 所</td>
                    <td>： {_h(getattr(project, 'project_location', '') or '')}</td>
                </tr>
                <tr>
                    <td class="condition-label-wide">見 積 有 効 期 限</td>
                    <td>： {_h(valid_until_str)}</td>
                </tr>
                <tr>
                    <td class="condition-label">支 払 条 件</td>
                    <td>： {_h(getattr(quote, 'payment_condition', '') or '')}</td>
                </tr>
                <tr>
                    <td class="condition-label">工 期</td>
                    <td>： {_h(period_str)}</td>
                </tr>
                {"<tr class='no-border'><td class='condition-label'>備 考</td><td class='remarks-content'>" + remarks_html + "</td></tr>" if remarks_html else "<tr class='no-border'><td class='condition-label'>備 考</td><td></td></tr>"}
            </table>
        </div>

        <div class="column-right">
            <div class="company-container">
                <div class="company-header-row">
                    <div class="company-logo-area">
                        {logo_html}
                    </div>
                    <div class="company-info">
                        <div class="company-name-big">{_h(co.name)}</div>
                        <div class="company-details">
                            〒{_h(co.postal_code)} {_h(co.address)}<br>
                            TEL.{_h(co.tel)} FAX.{_h(co.fax)}
                        </div>
                    </div>
                </div>

                <div class="stamp-table-wrapper">
                    <table class="stamp-table">
                        <thead>
                            <tr>
                                <th>承 認</th>
                                <th>審 査</th>
                                <th>担 当</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {stamp_td_approver}
                                {stamp_td_reviewer}
                                {stamp_td_pic}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {contact_block}
            </div>
        </div>
    </div>

</body></html>"""

    # ── 内訳書 HTML（縦向きA4）────────────────────────────────────────────────
    # 大項目別グループ化
    section_map: dict[str, list] = {}
    unsectioned: list = []
    for sec in sorted(sections, key=lambda s: s.row_no):
        section_map[str(sec.id)] = []
    for item in sorted(items, key=lambda i: i.row_no):
        sid = str(getattr(item, "section_id", None) or "")
        if sid in section_map:
            section_map[sid].append(item)
        else:
            unsectioned.append(item)

    rows_html = ""
    for sec in sorted(sections, key=lambda s: s.row_no):
        sec_items = section_map[str(sec.id)]
        sec_total = sum((i.amount or 0) for i in sec_items)
        rows_html += f"""
        <tr style="background:#BDD7EE; font-weight:bold;">
          <td colspan="5">{_h(sec.section_letter)}. {_h(sec.section_name)}</td>
          <td style="text-align:right;">{_fmt_yen(sec_total)}</td>
          <td></td>
        </tr>"""
        for item in sec_items:
            rows_html += f"""
            <tr>
              <td>{_h(item.item_name)}</td>
              <td style="font-size:8pt;">{_h(item.spec or '')}</td>
              <td style="text-align:center;">{_h(item.unit or '')}</td>
              <td style="text-align:right;">{_h(str(item.quantity) if item.quantity else '')}</td>
              <td style="text-align:right;">{_fmt_yen(item.unit_price)}</td>
              <td style="text-align:right;font-weight:bold;">{_fmt_yen(item.amount)}</td>
              <td style="font-size:8pt;">{_h(item.remarks or '')}</td>
            </tr>"""
    for item in unsectioned:
        rows_html += f"""
        <tr>
          <td>{_h(item.item_name)}</td>
          <td style="font-size:8pt;">{_h(item.spec or '')}</td>
          <td style="text-align:center;">{_h(item.unit or '')}</td>
          <td style="text-align:right;">{_h(str(item.quantity) if item.quantity else '')}</td>
          <td style="text-align:right;">{_fmt_yen(item.unit_price)}</td>
          <td style="text-align:right;font-weight:bold;">{_fmt_yen(item.amount)}</td>
          <td style="font-size:8pt;">{_h(item.remarks or '')}</td>
        </tr>"""

    discount_row = ""
    if discount:
        discount_row = f"""
        <tr style="background:#f0f4fa;font-weight:bold;">
          <td colspan="5" style="color:#C00000;">出精値引き</td>
          <td style="text-align:right;color:#C00000;">▲{_fmt_yen(discount)}</td><td></td>
        </tr>"""

    detail_html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>
@page {{ size: A4 portrait; margin: 18mm 15mm 22mm 15mm;
  @bottom-center {{ content: "{_h(co.name)}　P-" counter(page); font-size:7.5pt; color:#555; }}
}}
* {{ box-sizing:border-box; margin:0; padding:0; }}
body {{ font-family:'Noto Sans CJK JP','Noto Serif JP',serif; font-size:8.5pt; color:#111; line-height:1.5; }}
table {{ width:100%; border-collapse:collapse; }}
th,td {{ border:0.5pt solid #888; padding:2pt 4pt; }}
th {{ background:#1F4E79; color:#fff; text-align:center; font-size:8pt; }}
</style></head>
<body>

<h2 style="text-align:center;font-size:10pt;letter-spacing:0.2em;margin-bottom:6pt;">内　訳　書　（{_h(project.project_name)}）</h2>
<p style="font-size:7.5pt;margin-bottom:6pt;text-align:right;">見積番号：{_h(quote_number)}</p>

<table>
  <thead>
    <tr>
      <th style="width:27%">名称・摘要</th>
      <th style="width:14%">仕様</th>
      <th style="width:6%">単位</th>
      <th style="width:7%">数量</th>
      <th style="width:13%">単価</th>
      <th style="width:14%">金額</th>
      <th style="width:19%">備考</th>
    </tr>
  </thead>
  <tbody>
    {rows_html}
    {discount_row}
    <tr style="background:#f0f4fa;font-weight:bold;">
      <td colspan="5">小　計</td>
      <td style="text-align:right;">{_fmt_yen(subtotal)}</td><td></td>
    </tr>
    <tr style="background:#dce6f1;">
      <td colspan="5">消費税（10%）</td>
      <td style="text-align:right;">{_fmt_yen(tax)}</td><td></td>
    </tr>
    <tr style="background:#1F4E79;color:#fff;font-weight:bold;font-size:10pt;">
      <td colspan="5">合　計</td>
      <td style="text-align:right;">{_fmt_yen(total)}</td><td></td>
    </tr>
  </tbody>
</table>

</body></html>"""

    return cover_html, detail_html

# ── CompanyInfo をDB設定から構築 ──────────────────────────────────────────────

def company_info_from_db(settings: Any) -> CompanyInfo:
    """CompanySettings モデルから CompanyInfo を構築する。"""
    return CompanyInfo(
        name=settings.company_name or "株式会社クラップ",
        name_en=settings.company_name_en or "CLAP CORPORATION",
        postal_code=settings.postal_code or "913-0043",
        address=settings.address or "福井県坂井市三国町錦3-4-2",
        tel=settings.tel or "0776-81-8330",
        fax=settings.fax or "0776-81-8331",
        representative=settings.representative_name or "奴間 正人",
        tax_reg_no=settings.tax_registration_number or "T5210001007332",
        bank_name=settings.bank_name or "福井銀行",
        bank_branch=settings.bank_branch or "経田支店",
        bank_account_type=settings.bank_account_type or "普通",
        bank_account_number=settings.bank_account_number or "1068586",
        bank_account_holder=settings.bank_account_holder or "株式会社クラップ",
    )

