"""WeasyPrint による PDF 帳票生成サービス。"""
from __future__ import annotations

import base64
import html
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

_HERE = Path(__file__).parent
_LOGO_PATH = _HERE.parent / "templates" / "images" / "clap_logo.png"


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
.company-logo-area { margin-bottom: 8mm; height: 40pt; }
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
    line-height: 1.1; padding-top: 7pt; text-align: center;
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
        full_name = stamp_users.get(key, "") if key else ""
        if full_name and at:
            # 押印済み: 苗字（姓）を赤丸で表示
            # 姓名はスペース区切りの場合は先頭パート、なければ名前全体
            parts = full_name.split()
            surname = parts[0] if parts else full_name
            return f'<td><div class="stamp-circle">{_h(surname)}</div></td>'
        else:
            # 未押印: 空セル
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
    remarks_html = _h(remarks_raw).replace("\n", "<br>") if remarks_raw else ""

    # ── 担当者連絡先ブロック ──────────────────────────────────────────────────
    contact_block = ""
    if pic_name:
        contact_block = f"""
        <div class="contact-box">
            <div class="title-msg">この見積書についてのご用命、お問い合わせは<br>下記担当者へ連絡をお願いします。</div>
            <table class="contact-info-table">
                <tr>
                    <td class="contact-info-label">担当者：</td>
                    <td class="contact-info-value">{_h(pic_name)}</td>
                </tr>
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
                {"<tr class='no-border'><td class='condition-label'>備 考</td><td class='remarks-content'>： " + remarks_html + "</td></tr>" if remarks_html else "<tr class='no-border'><td class='condition-label'>備 考</td><td></td></tr>"}
            </table>
        </div>

        <div class="column-right">
            <div class="company-container">
                <div class="company-logo-area">
                    {logo_html}
                </div>

                <div class="company-name-big">{_h(co.name)}</div>
                <div class="company-details">
                    〒{_h(co.postal_code)} {_h(co.address)}<br>
                    TEL.{_h(co.tel)} FAX.{_h(co.fax)}
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


# ── 請求書 PDF ────────────────────────────────────────────────────────────────

def generate_invoice_pdf(invoice: Any, project: Any, company: CompanyInfo,
                         payments: list | None = None) -> bytes:
    """請求書 PDF を生成する。"""
    import weasyprint
    html_str = _render_invoice_html(invoice, project, company, payments or [])
    return weasyprint.HTML(string=html_str).write_pdf()


def _render_invoice_html(invoice: Any, project: Any, co: CompanyInfo, payments: list) -> str:
    logo_url = _logo_data_url()
    logo_img = f'<img src="{logo_url}" style="height:28pt; display:block; margin-bottom:3pt;" alt="CLAP">' if logo_url else ""
    client_name = getattr(project, "client_name", "") or ""
    inv_number = getattr(invoice, "invoice_number", "") or ""
    issued_at = _fmt_date(getattr(invoice, "issued_at", None) or getattr(invoice, "created_at", None))
    due_date = _fmt_date(getattr(invoice, "due_date", None))
    subtotal = invoice.subtotal or 0
    tax_amount = invoice.tax_amount or 0
    total = invoice.total_amount or 0
    project_number = getattr(project, "project_number", "") or ""

    paid_total = sum(p.amount or 0 for p in payments if getattr(p, "paid_at", None))
    balance_forward = 0
    current_amount = total

    items_html = ""
    for item in sorted(getattr(invoice, "items", []) or [], key=lambda x: getattr(x, "row_no", 0)):
        items_html += f"""
        <tr>
          <td class="center">{_fmt_date(getattr(item,'item_date',None))}</td>
          <td>{_h(item.description or '')}</td>
          <td class="right">{_fmt_yen(item.amount)}</td>
          <td class="small">{_h(item.remarks or '')}</td>
        </tr>"""
    if not items_html:
        items_html = f"""
        <tr>
          <td></td>
          <td>{_h(project.project_name)}</td>
          <td class="right">{_fmt_yen(subtotal)}</td>
          <td></td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>{_BASE_CSS}
  .inv-header {{ display: flex; justify-content: space-between; margin-bottom: 12pt; }}
  .inv-summary {{ border: 0.8pt solid #888; padding: 6pt 10pt; margin-bottom: 10pt; }}
  .inv-summary table {{ width: auto; }}
  .inv-summary td {{ border: none; padding: 2pt 16pt 2pt 4pt; }}
</style></head>
<body>

  <div class="inv-header">
    <div>
      <div class="small muted">弊社工事番号：{_h(project_number)}</div>
      <div class="small muted">発行日：{issued_at}</div>
    </div>
    <div class="small muted" style="text-align:right;">
      請求番号：{_h(inv_number)}<br>
      支払期限：{due_date}
    </div>
  </div>

  <h1>請　求　書</h1>

  <div style="display:flex; justify-content:space-between; margin-bottom:12pt;">
    <div>
      <div style="font-size:13pt; border-bottom:1pt solid #111; padding-bottom:3pt; margin-bottom:6pt;">
        {_h(client_name)}　御中
      </div>
      <div class="info-grid">
        <span class="info-label">工事名称</span>
        <span class="info-value">{_h(project.project_name)}</span>
      </div>
    </div>
    <div class="company-block" style="width:200pt;">
      {logo_img}
      <div class="company-name">{_h(co.name)}</div>
      <div>〒{_h(co.postal_code)} {_h(co.address)}</div>
      <div>TEL: {_h(co.tel)}</div>
      <div class="small muted">登録番号 {_h(co.tax_reg_no)}</div>
    </div>
  </div>

  <div class="inv-summary no-break">
    <table>
      <tr><td class="muted small">前月請求額</td><td class="right">{_fmt_yen(balance_forward)}</td></tr>
      <tr><td class="muted small">御入金</td><td class="right">{_fmt_yen(paid_total)}</td></tr>
      <tr><td class="muted small">差引残高</td><td class="right">{_fmt_yen(balance_forward - paid_total)}</td></tr>
      <tr><td class="muted small" style="border-top:1pt solid #888;">当月御買上額（税抜）</td>
          <td class="right" style="border-top:1pt solid #888;">{_fmt_yen(subtotal)}</td></tr>
      <tr><td class="muted small">消費税額（10%）</td><td class="right">{_fmt_yen(tax_amount)}</td></tr>
      <tr style="font-size:11pt; font-weight:bold;">
        <td style="color:#1F4E79;">今回御請求額</td>
        <td class="right" style="color:#1F4E79;">{_fmt_yen(total)}</td>
      </tr>
    </table>
  </div>

  <table style="margin-bottom:10pt;">
    <thead>
      <tr>
        <th style="width:14%">日付</th>
        <th style="width:46%">工事名・備考</th>
        <th style="width:20%">金額</th>
        <th style="width:20%">摘要</th>
      </tr>
    </thead>
    <tbody>
      {items_html}
      <tr class="subtotal-row">
        <td colspan="2" class="bold">小　計</td>
        <td class="right bold">{_fmt_yen(subtotal)}</td><td></td>
      </tr>
      <tr class="tax-row">
        <td colspan="2">消費税（10%）</td>
        <td class="right">{_fmt_yen(tax_amount)}</td><td></td>
      </tr>
      <tr class="total-row">
        <td colspan="2">合　計</td>
        <td class="right">{_fmt_yen(total)}</td><td></td>
      </tr>
    </tbody>
  </table>

  <div class="company-block small no-break">
    <div class="bold" style="margin-bottom:3pt;">【振込先】</div>
    {_h(co.bank_name)}　{_h(co.bank_branch)}　{_h(co.bank_account_type)}　{_h(co.bank_account_number)}<br>
    口座名義：{_h(co.bank_account_holder)}
  </div>

</body></html>"""


# ── 注文書 / 注文請書 PDF ─────────────────────────────────────────────────────

_CLAUSES = [
    ("第1条（権利義務の譲渡禁止）",
     "受注者は、この契約から生ずる権利義務を第三者に譲渡し、または承継させてはならない。"),
    ("第2条（一括下請負の禁止）",
     "受注者は、工事の全部または主要な部分を第三者に一括して下請負に付してはならない。"),
    ("第3条（現場代理人）",
     "受注者は、工事現場に現場代理人を置き、工事の施工および契約の履行に関する事項を処理しなければならない。"),
    ("第4条（材料の品質）",
     "工事に使用する材料は設計書に定めるものとし、設計書に定めのない場合は監理者の承認を受けた品質の材料を使用しなければならない。"),
    ("第5条（工期の変更）",
     "発注者は必要があると認めるときは、受注者と協議して工期を変更することができる。"),
    ("第6条（損害の負担）",
     "天災その他不可抗力による損害は発注者の負担とする。ただし受注者の故意または重大な過失による損害はこの限りでない。"),
    ("第7条（検査）",
     "受注者は工事完成後、発注者の検査を受けなければならない。検査合格後に工事完成と見なす。"),
    ("第8条（引渡）",
     "工事完成検査合格後、受注者は速やかに発注者に目的物を引き渡すものとする。"),
    ("第9条（代金の支払）",
     "発注者は目的物の引渡しを受けた後、受注者から適法な請求書の提出を受けた日から30日以内に請負代金を支払うものとする。"),
]


def generate_order_pdf(order: Any, project: Any, company: CompanyInfo) -> bytes:
    """注文書 PDF を生成する。"""
    import weasyprint
    html_str = _render_order_html(order, project, company, is_acknowledgment=False)
    return weasyprint.HTML(string=html_str).write_pdf()


def generate_acknowledgment_pdf(ack: Any, project: Any, company: CompanyInfo) -> bytes:
    """注文請書 PDF を生成する。"""
    import weasyprint
    html_str = _render_order_html(ack, project, company, is_acknowledgment=True)
    return weasyprint.HTML(string=html_str).write_pdf()


def _render_order_html(doc: Any, project: Any, co: CompanyInfo, is_acknowledgment: bool) -> str:
    logo_url = _logo_data_url()
    logo_img = f'<img src="{logo_url}" style="height:28pt; display:block; margin-bottom:3pt;" alt="CLAP">' if logo_url else ""
    title = "注　文　請　書" if is_acknowledgment else "注　文　書"
    doc_number = getattr(doc, "acknowledgment_number" if is_acknowledgment else "order_number", "") or ""
    issued_at = _fmt_date(getattr(doc, "issued_at", None) or getattr(doc, "created_at", None))
    subtotal = getattr(doc, "amount", None) or getattr(doc, "subtotal", None) or 0
    tax_amount = getattr(doc, "tax_amount", None) or int(subtotal * 0.1)
    total = getattr(doc, "total_amount", None) or (subtotal + tax_amount)
    stamp_tax = getattr(doc, "stamp_tax", None) or 0
    vendor_name = getattr(doc, "vendor_name", "") or getattr(project, "client_name", "") or ""
    payment_condition = getattr(doc, "payment_condition", "") or getattr(project, "payment_condition", "") or ""
    project_number = getattr(project, "project_number", "") or ""

    clauses_html = ""
    for title_c, body in _CLAUSES:
        clauses_html += f"""
        <div class="clause no-break">
          <span class="clause-title">{_h(title_c)}</span><br>
          {_h(body)}
        </div>"""

    signature_block = ""
    if is_acknowledgment:
        signature_block = """
        <div class="no-break" style="margin-top:24pt; border:0.8pt solid #888; padding:10pt;">
          <div class="bold" style="margin-bottom:8pt;">【請負者】</div>
          <div class="info-grid">
            <span class="info-label">会社名</span><span class="info-value" style="border-bottom:0.5pt solid #888; min-height:16pt;"></span>
            <span class="info-label">住所</span><span class="info-value" style="border-bottom:0.5pt solid #888; min-height:16pt;"></span>
            <span class="info-label">代表者氏名</span><span class="info-value" style="border-bottom:0.5pt solid #888; min-height:16pt;"></span>
            <span class="info-label">印</span><span class="info-value" style="min-height:40pt;"></span>
          </div>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>{_BASE_CSS}
  .order-summary {{ border:0.8pt solid #888; padding:6pt 10pt; margin-bottom:10pt; }}
  .order-summary table {{ width:auto; }}
  .order-summary td {{ border:none; padding:2pt 20pt 2pt 4pt; }}
</style></head>
<body>

  <div style="display:flex; justify-content:space-between; margin-bottom:8pt;">
    <div class="small muted">弊社工事番号：{_h(project_number)}</div>
    <div class="small muted" style="text-align:right;">
      書類番号：{_h(doc_number)}<br>
      発行日：{issued_at}
    </div>
  </div>

  <h1>{title}</h1>

  <div style="display:flex; justify-content:space-between; margin-bottom:12pt;">
    <div>
      <div style="font-size:13pt; border-bottom:1pt solid #111; padding-bottom:3pt; margin-bottom:6pt;">
        {_h(vendor_name)}　御中
      </div>
      <div class="small">下記の通り発注いたします。</div>
    </div>
    <div class="company-block" style="width:200pt;">
      {logo_img}
      <div class="company-name">{_h(co.name)}</div>
      <div>〒{_h(co.postal_code)} {_h(co.address)}</div>
      <div>TEL: {_h(co.tel)} / FAX: {_h(co.fax)}</div>
      <div>代表取締役　{_h(co.representative)}</div>
    </div>
  </div>

  <div class="order-summary no-break">
    <table>
      <tr>
        <td class="muted small">工事名称</td>
        <td class="bold">{_h(project.project_name)}</td>
      </tr>
      <tr>
        <td class="muted small">工事場所</td>
        <td>{_h(getattr(project,'project_location','') or '')}</td>
      </tr>
      <tr>
        <td class="muted small">工事代金（税抜）</td>
        <td class="right bold">{_fmt_yen(subtotal)}</td>
      </tr>
      <tr>
        <td class="muted small">消費税（10%）</td>
        <td class="right">{_fmt_yen(tax_amount)}</td>
      </tr>
      <tr style="font-size:11pt;">
        <td class="bold">請負代金額（税込）</td>
        <td class="right bold" style="color:#1F4E79;">{_fmt_yen(total)}</td>
      </tr>
      {"<tr><td class='muted small'>印紙税</td><td class='right small'>"+_fmt_yen(stamp_tax)+"</td></tr>" if stamp_tax else ""}
      <tr>
        <td class="muted small">工事期間</td>
        <td>{_fmt_date(getattr(project,'period_start',None))} ～ {_fmt_date(getattr(project,'period_end',None))}</td>
      </tr>
      <tr>
        <td class="muted small">支払条件</td>
        <td>{_h(payment_condition)}</td>
      </tr>
    </table>
  </div>

  <h2>基本契約約款</h2>
  {clauses_html}

  {signature_block}

</body></html>"""


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


# ── 写真台帳 PDF ─────────────────────────────────────────────────────────────

_PHOTO_TYPE_LABEL: dict[str, str] = {
    "before": "施工前",
    "during": "施工中",
    "after":  "施工後",
    "issue":  "問題箇所",
    "drawing": "図面",
}

_PHOTO_ALBUM_CSS = """
@page { size: A4 portrait; margin: 15mm 12mm 18mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'Noto Sans CJK JP', 'Noto Serif JP', sans-serif;
    color: #000; font-size: 9pt; line-height: 1.5;
}
/* タイトルページ */
.title-page {
    text-align: center;
    padding-top: 40mm;
    page-break-after: always;
}
.title-page h1 { font-size: 22pt; font-weight: bold; letter-spacing: 8px; margin-bottom: 20mm; }
.title-page table { margin: 0 auto; border-collapse: collapse; width: 120mm; }
.title-page td { padding: 4pt 8pt; border-bottom: 1px solid #ccc; font-size: 10pt; }
.title-page td:first-child { font-weight: bold; width: 32mm; text-align: left; }
.title-page .company-footer { margin-top: 30mm; font-size: 11pt; font-weight: bold; }

/* セクション */
.section { margin-bottom: 8mm; }
.section-title {
    font-size: 13pt; font-weight: bold;
    border-left: 5px solid #1a56db;
    padding-left: 8pt;
    margin-bottom: 6mm;
}
/* 写真グリッド: 2列 */
.photo-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 4mm; }
.photo-row { display: table-row; }
.photo-cell { display: table-cell; width: 50%; vertical-align: top; }
.photo-box { border: 1px solid #ccc; padding: 3pt; margin-bottom: 1mm; }
.photo-box img { width: 100%; display: block; max-height: 65mm; object-fit: cover; }
.photo-meta { font-size: 7.5pt; color: #444; margin-top: 2pt; }
.photo-caption { font-size: 8.5pt; margin-top: 1pt; line-height: 1.4; }
/* ページフッター */
@page { @bottom-center { content: "株式会社クラップ"; font-size: 8pt; color: #666; } }
@page { @bottom-right { content: "P - " counter(page); font-size: 8pt; color: #666; } }
"""


def _photo_img_tag(b64: str, mime: str) -> str:
    return f'<img src="data:{mime};base64,{b64}" />'


def generate_photo_album_pdf(
    project_name: str,
    project_number: str,
    client_name: str | None,
    period_start: str | None,
    period_end: str | None,
    photo_groups: list[dict],
    company: CompanyInfo,
) -> bytes:
    """写真台帳 PDF を生成する。

    photo_groups: [{"label": str, "photos": [{"b64": str, "mime_type": str, "caption": str,
                    "work_type": str|None, "taken_at": str|None}]}]
    """
    import weasyprint

    logo_url = _logo_data_url()
    logo_img = f'<img src="{logo_url}" style="height:22pt; margin-bottom:6mm;" alt="CLAP">' if logo_url else ""

    period = ""
    if period_start or period_end:
        period = f"{period_start or '—'} 〜 {period_end or '—'}"

    # タイトルページ
    title_html = f"""
<div class="title-page">
  {logo_img}
  <h1>工 事 写 真 台 帳</h1>
  <table>
    <tr><td>工 事 名</td><td>{_h(project_name)}</td></tr>
    <tr><td>工事番号</td><td>{_h(project_number)}</td></tr>
    <tr><td>発 注 者</td><td>{_h(client_name or '—')}</td></tr>
    <tr><td>工　　期</td><td>{_h(period or '—')}</td></tr>
  </table>
  <div class="company-footer">{_h(company.name)}</div>
</div>
"""

    # 写真セクション
    sections_html = ""
    for group in photo_groups:
        if not group.get("photos"):
            continue
        photos = group["photos"]
        label = _h(group.get("label", "その他"))

        rows_html = ""
        for i in range(0, len(photos), 2):
            pair = photos[i: i + 2]
            cells_html = ""
            for photo in pair:
                img_tag = _photo_img_tag(photo["b64"], photo.get("mime_type", "image/jpeg"))
                taken = photo.get("taken_at", "") or ""
                work  = photo.get("work_type", "") or ""
                cap   = photo.get("caption", "") or ""
                meta_parts = [p for p in [taken, work] if p]
                meta_str = " ／ ".join(meta_parts)
                cells_html += f"""
<td class="photo-cell">
  <div class="photo-box">{img_tag}</div>
  {f'<div class="photo-meta">{_h(meta_str)}</div>' if meta_str else ""}
  {f'<div class="photo-caption">{_h(cap)}</div>' if cap else ""}
</td>"""
            # 奇数枚の場合は空セルで埋める
            if len(pair) == 1:
                cells_html += '<td class="photo-cell"></td>'
            rows_html += f'<tr class="photo-row">{cells_html}</tr>'

        sections_html += f"""
<div class="section">
  <div class="section-title">{label}</div>
  <table class="photo-grid"><tbody>{rows_html}</tbody></table>
</div>
"""

    html_str = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<style>{_PHOTO_ALBUM_CSS}</style>
</head>
<body>
{title_html}
{sections_html}
</body></html>"""

    return weasyprint.HTML(string=html_str).write_pdf()
