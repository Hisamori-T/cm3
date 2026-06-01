# 設計書 追補：QCDS業務マスタ（自動計算ロジック）

**作成者**：平等 久盛
**作成日**：2026年5月13日
**バージョン**：1.0
**位置づけ**：設計書 Part1 のデータモデルへの追補。Phase 1 必須機能として組み込む

---

## 0. 背景：Excelに埋もれていた業務ロジック

現行Excel「QCDS原価算定表」シートの**右側エリア（30〜77列）**に、業務上の重要な計算ロジックとマスタデータが大量に埋め込まれていることが判明した。これらは「QCDSの本体表」とは別領域にあり、見落としやすいが、すべて自動計算の根拠データである。

このまま放置するとWeb版でも「数値を手動で都度入力する」運用になってしまうため、これらのロジックを**業務マスタテーブル群**として独立させ、管理画面から更新可能にする。

---

## 1. 抽出されたマスタデータ一覧

### 1.1 契約印紙税テーブル（既に設計書 Part1 で言及済み、ここで詳細化）

工事請負契約書に貼る印紙の金額。工事価格5,000万円未満の工事に適用。

| 金額帯（円） | 印紙税額 | 備考 |
|---|---|---|
| 0 〜 9,999 | 0 | |
| 10,000 〜 2,000,000 | 200 | |
| 2,000,001 〜 3,000,000 | 500 | |
| 3,000,001 〜 5,000,000 | 1,000 | |
| 5,000,001 〜 10,000,000 | 5,000 | |
| 10,000,001 〜 50,000,000 | 10,000 | |
| 50,000,001 〜 100,000,000 | 30,000 | |
| 100,000,001 〜 500,000,000 | 60,000 | |
| 500,000,001 〜 1,000,000,000 | 160,000 | |
| 1,000,000,001 〜 5,000,000,000 | 320,000 | |
| 5,000,000,001 〜 | 480,000 | |

### 1.2 領収書印紙税テーブル

売上の領収書に貼る印紙の金額。

| 金額帯（円） | 印紙税額 |
|---|---|
| 0 〜 49,999 | 0 |
| 50,000 〜 1,000,000 | 200 |
| 1,000,001 〜 2,000,000 | 400 |
| 2,000,001 〜 3,000,000 | 600 |
| 3,000,001 〜 5,000,000 | 1,000 |
| 5,000,001 〜 10,000,000 | 2,000 |
| 10,000,001 〜 20,000,000 | 4,000 |
| 20,000,001 〜 30,000,000 | 6,000 |
| 30,000,001 〜 50,000,000 | 10,000 |
| 50,000,001 〜 100,000,000 | 20,000 |
| 100,000,001 〜 200,000,000 | 40,000 |
| 200,000,001 〜 300,000,000 | 60,000 |
| 300,000,001 〜 500,000,000 | 100,000 |
| 500,000,001 〜 1,000,000,000 | 150,000 |
| 1,000,000,001 〜 | 200,000 |

### 1.3 保険料率マスタ

工事価格や請負金に対して、自動的に保険料を算出するための率。

| 保険種別 | 率 | 計算式 | 元請/下請 | 備考 |
|---|---|---|---|---|
| 労災保険（一括有期） | 0.1973% | 工事価格 × 0.1973% | 元請のみ | 工事価格1億8千万円以上は単独有期で直接入力 |
| 工事保険・賠償責任保険 | 0.2095% | 請負金 × 0.2095% | 元請のみ | |
| 特殊保険（設備生産物） | 0.0110% | 請負金 × 生産物率 × 0.0110% | 設備工事時のみ | 別途加入時は直接入力 |
| 特殊保険（解体工事賠責） | 1.8053% | （個別） | 解体工事時のみ | 別途加入時は直接入力 |

**保険要否の切替**：
- 元請：労災保険、工事保険を「●（要）」
- 下請：両方「−（否）」
- 設備工事あり：特殊保険（設備生産物）を「●」
- 解体工事あり：特殊保険（解体工事賠責）を「●」

### 1.4 事業部経費率マスタ

| 項目 | 率 | 計算式 |
|---|---|---|
| 担当者給与（現場担当者） | 3.0% | 工事価格 × 3.0% |
| 工事部経費（共通） | 0.0%（初期値、案件ごと調整） | 工事価格 × N% |
| 共通経費 | 3.0% | 工事価格 × 3.0% |
| 一般管理費 | 2.0% | 工事価格 × 2.0% |

### 1.5 人件費単価マスタ

現場担当者の実人件費計算用。「人件費単価 × 工期 × 従事率 × 人数」で算出。

| 経験区分 | 月単価 |
|---|---|
| 2年目〜9年目 | 600,000円/月 |
| 10年目以上 | 850,000円/月 |
| シニア社員 | 650,000円/月 |

※新人（1年目）の扱いは現行Excelにないので要確認

### 1.6 営業利益率→工事価格の逆算テーブル（顧客提出価格試算表）

工事原価が確定した後、目標利益率に対して顧客提示価格を逆算するためのテーブル。

| 実行比率 | 営業利益 | 計算式 |
|---|---|---|
| 103% | 粗利益 0% | 工事原価 × 103% = 工事価格 |
| 100% | 営業利益 0% | 工事原価 × 100% |
| 99% | 営業利益 1.0% | 工事原価 ÷ 0.99 |
| 98% | 営業利益 2.0% | 工事原価 ÷ 0.98 |
| 97% | 営業利益 3.0% | 工事原価 ÷ 0.97 |

これは「顧客に提示する見積価格をいくつかの利益率パターンで自動計算して比較できるUI」として実装する。

### 1.7 適用条件マスタ

QCDS本体に書かれている「適用条件」も注釈テーブルとして管理：

- *QCDS原価算定表は **工事価格5,000万円未満** の工事に適用*
- *単独有期（工事価格1億8千万円以上）の場合は労災保険率を直接入力*
- *対象案件3,000千円以上で実際の現場人件費を記入*

---

## 2. データモデル追加

### 2.1 stamp_tax_table（契約印紙税テーブル、Part1 で定義済み）

定義済みのため省略。`tax_type` ENUMに `contract` を持つ。

### 2.2 receipt_stamp_tax_table（領収書印紙税テーブル）

設計書 Part1 の stamp_tax_table を拡張し、tax_type で識別する形に統合：

```
stamp_tax_table を統合版に変更：
| カラム | 型 |
|---|---|
| id | UUID PK |
| tax_type | ENUM('contract', 'receipt') |
| min_amount | DECIMAL |
| max_amount | DECIMAL |
| tax_amount | DECIMAL |
| effective_from | DATE |
| note | TEXT |
```

### 2.3 insurance_rates（保険料率マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| insurance_code | VARCHAR | `labor`, `construction`, `special_equipment`, `special_demolition` |
| insurance_label | VARCHAR | 表示名（例：「労災保険（一括有期）」） |
| rate | DECIMAL(7,6) | 0.001973 など |
| base | ENUM | `project_price`（工事価格基準）/ `contract_amount`（請負金基準） |
| applicable_to | ENUM | `prime_contractor_only`（元請のみ）/ `both`/ `conditional`（条件付き） |
| condition_note | TEXT | 適用条件の説明 |
| direct_input_threshold | DECIMAL NULL | 直接入力が必要になる閾値（例：労災は1.8億円以上） |
| effective_from | DATE | |
| is_default_required | BOOL | 初期値で「●（要）」か「−（否）」か |

### 2.4 overhead_rates（事業部経費率マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| rate_code | VARCHAR | `site_staff_salary`, `construction_dept`, `common`, `general_admin` |
| rate_label | VARCHAR | 表示名 |
| rate | DECIMAL(5,4) | 0.03 など |
| is_editable_per_project | BOOL | 案件ごとに変更可能か |
| effective_from | DATE | |

### 2.5 labor_unit_prices（人件費単価マスタ）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| experience_code | VARCHAR | `junior`, `mid`, `senior_employee`, `senior_member` |
| experience_label | VARCHAR | 「2年目〜9年目」など |
| min_experience_years | INT NULL | 2 |
| max_experience_years | INT NULL | 9 |
| monthly_unit_price | DECIMAL | 600,000 |
| effective_from | DATE | |

### 2.6 profit_calculation_table（営業利益逆算テーブル）

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| execution_ratio | DECIMAL(5,4) | 0.97, 0.98, 0.99, 1.00, 1.03 |
| profit_label | VARCHAR | 「粗利益 0%」「営業利益 1.0%」など |
| profit_rate | DECIMAL(5,4) | 0, 0.01, 0.02, 0.03 |
| display_order | INT | 表示順 |
| is_default | BOOL | デフォルト選択 |
| effective_from | DATE | |

### 2.7 qcds_business_rules（QCDS本体の適用条件マスタ）

業務ルール（注釈）を一元管理。

| カラム | 型 | 説明 |
|---|---|---|
| id | UUID PK | |
| rule_code | VARCHAR | `qcds_applicable_threshold`, `labor_direct_input`, `actual_labor_cost_min` 等 |
| rule_label | VARCHAR | |
| threshold_amount | DECIMAL NULL | 50,000,000（5,000万円）等 |
| description | TEXT | UIにツールチップ表示 |
| effective_from | DATE | |

例：
- `qcds_applicable_threshold`: 50,000,000 / 「QCDS原価算定表は工事価格5,000万円未満の工事に適用」
- `labor_insurance_direct_input`: 180,000,000 / 「工事価格1億8千万円以上は労災保険率を直接入力」
- `actual_labor_cost_min`: 3,000,000 / 「対象案件3,000千円以上で実際の現場人件費を記入」

---

## 3. 自動計算ロジック設計

### 3.1 印紙税自動算定サービス

```python
# backend/app/services/stamp_tax_calculator.py
from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def calculate_stamp_tax(
    amount: Decimal,
    tax_type: str,  # 'contract' or 'receipt'
    on_date: date,
    db: AsyncSession,
) -> Decimal:
    """印紙税額を自動算定"""
    stmt = (
        select(StampTaxTable)
        .where(
            StampTaxTable.tax_type == tax_type,
            StampTaxTable.effective_from <= on_date,
            StampTaxTable.min_amount <= amount,
            StampTaxTable.max_amount >= amount,
        )
        .order_by(StampTaxTable.effective_from.desc())
        .limit(1)
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    return row.tax_amount if row else Decimal(0)
```

### 3.2 保険料自動算定サービス

```python
# backend/app/services/insurance_calculator.py
async def calculate_insurance_premium(
    insurance_code: str,
    project_price: Decimal,
    contract_amount: Decimal,
    is_prime_contractor: bool,
    has_equipment_work: bool,
    has_demolition_work: bool,
    on_date: date,
    db: AsyncSession,
) -> tuple[Decimal, bool, str]:
    """
    保険料を算出
    Returns: (保険料額, 適用要否, 補足メッセージ)
    """
    rate_row = await get_insurance_rate(insurance_code, on_date, db)

    # 適用判定
    is_applicable = _determine_applicability(
        rate_row.applicable_to,
        is_prime_contractor,
        has_equipment_work,
        has_demolition_work,
    )
    if not is_applicable:
        return Decimal(0), False, "対象外"

    # 直接入力閾値チェック
    base_amount = project_price if rate_row.base == 'project_price' else contract_amount
    if rate_row.direct_input_threshold and base_amount >= rate_row.direct_input_threshold:
        return Decimal(0), True, f"閾値超過のため直接入力が必要（{rate_row.condition_note}）"

    premium = base_amount * rate_row.rate
    return premium, True, ""
```

### 3.3 顧客提出価格試算サービス

```python
# backend/app/services/quote_pricing_calculator.py
async def calculate_quote_pricing_options(
    construction_cost: Decimal,
    on_date: date,
    db: AsyncSession,
) -> list[QuotePricingOption]:
    """
    工事原価に対して、複数の利益率パターンで顧客提示価格を逆算
    Returns: [
      {execution_ratio: 1.03, profit_label: "粗利益 0%", quote_price: ¥10,300,000},
      {execution_ratio: 1.00, profit_label: "営業利益 0%", quote_price: ¥10,000,000},
      ...
    ]
    """
    rows = await get_profit_calculation_table(on_date, db)
    options = []
    for row in rows:
        if row.execution_ratio >= 1:
            # 103% → 工事原価 × 1.03
            quote_price = construction_cost * row.execution_ratio
        else:
            # 99% → 工事原価 / 0.99
            quote_price = construction_cost / row.execution_ratio
        options.append(QuotePricingOption(
            execution_ratio=row.execution_ratio,
            profit_label=row.profit_label,
            profit_rate=row.profit_rate,
            quote_price=quote_price.quantize(Decimal('1')),
            is_default=row.is_default,
        ))
    return options
```

### 3.4 QCDS全体の派生計算

QCDS本体で必要な計算を一元化したサービス：

```python
# backend/app/services/qcds_calculator.py
async def calculate_qcds_full(qcds: QCDS, db: AsyncSession) -> QCDSCalculatedFields:
    """
    QCDS全体の派生フィールドを一括計算
    """
    # A 直接工事費合計
    direct_total = sum(work.budget_amount for work in qcds.direct_works)

    # B-1 現場経費（保険料 + 印紙代 + 事務用品 + 通信交通 + 雑費）
    labor_insurance = await calculate_insurance_premium(
        'labor', qcds.project.project_price, qcds.project.contract_amount,
        qcds.project.is_prime_contractor, ...
    )
    construction_insurance = await calculate_insurance_premium(
        'construction', ...
    )
    contract_stamp_tax = await calculate_stamp_tax(
        qcds.project.contract_amount, 'contract', date.today(), db
    )
    receipt_stamp_tax = await calculate_stamp_tax(
        qcds.project.contract_amount, 'receipt', date.today(), db
    )
    site_overhead_subtotal = (
        labor_insurance + construction_insurance +
        contract_stamp_tax + receipt_stamp_tax +
        qcds.office_supplies + qcds.communication_cost + qcds.misc_cost
    )

    # B-2 事業部経費
    overhead_rates = await get_overhead_rates(db)
    site_staff_salary = qcds.project.project_price * overhead_rates['site_staff_salary']
    construction_dept = qcds.project.project_price * (qcds.common_overhead_rate or 0)
    shared_overhead = qcds.project.project_price * overhead_rates['common']
    dept_overhead_subtotal = site_staff_salary + construction_dept + shared_overhead

    # B 経費関係合計
    overhead_subtotal_1 = site_overhead_subtotal + dept_overhead_subtotal
    overhead_subtotal_2 = site_overhead_subtotal + qcds.actual_site_personnel_cost

    # C その他経費
    general_admin = qcds.project.project_price * overhead_rates['general_admin']

    # 直工利益、粗利益
    direct_profit = qcds.project.project_price - direct_total - site_overhead_subtotal
    gross_profit_1 = qcds.project.project_price - direct_total - overhead_subtotal_1
    gross_profit_2 = qcds.project.project_price - direct_total - overhead_subtotal_2

    # 営業利益
    operating_profit_1 = gross_profit_1 - general_admin
    operating_profit_2 = gross_profit_2 - general_admin

    return QCDSCalculatedFields(
        direct_total=direct_total,
        site_overhead_subtotal=site_overhead_subtotal,
        dept_overhead_subtotal=dept_overhead_subtotal,
        overhead_subtotal_1=overhead_subtotal_1,
        overhead_subtotal_2=overhead_subtotal_2,
        general_admin=general_admin,
        direct_profit=direct_profit,
        direct_profit_rate=direct_profit / qcds.project.project_price,
        gross_profit_1=gross_profit_1,
        gross_profit_1_rate=gross_profit_1 / qcds.project.project_price,
        gross_profit_2=gross_profit_2,
        gross_profit_2_rate=gross_profit_2 / qcds.project.project_price,
        operating_profit_1=operating_profit_1,
        operating_profit_1_rate=operating_profit_1 / qcds.project.project_price,
        operating_profit_2=operating_profit_2,
        operating_profit_2_rate=operating_profit_2 / qcds.project.project_price,
        # 計算の根拠も返す（透明性のため）
        breakdown={
            'labor_insurance': labor_insurance,
            'construction_insurance': construction_insurance,
            'contract_stamp_tax': contract_stamp_tax,
            'receipt_stamp_tax': receipt_stamp_tax,
            ...
        },
    )
```

### 3.5 案件作成時の自動デフォルト値

新規案件作成時、QCDSの以下の項目に自動デフォルト値が入る：

| QCDSフィールド | デフォルト値 |
|---|---|
| 労災保険料率 | insurance_rates の 'labor' を参照 |
| 工事保険料率 | insurance_rates の 'construction' を参照 |
| 事務用品費 | 2,000円（既存値） |
| 通信交通費 | 10,000円（既存値） |
| 雑費 | 5,000円（既存値） |
| 担当者給与率 | overhead_rates の 'site_staff_salary'（3%） |
| 工事部経費率 | overhead_rates の 'construction_dept'（0%） |
| 共通経費率 | overhead_rates の 'common'（3%） |
| 一般管理費率 | overhead_rates の 'general_admin'（2%） |
| 目標営業利益率 | 10%（固定値、要件により別途調整可） |

これにより、新規案件作成→QCDS表示の瞬間に、現在のマスタ値が自動投入される。

---

## 4. 画面設計追加

### S05 QCDS画面の改修

QCDS画面に**「計算根拠の透明化UI」**を追加。各自動計算セルにカーソルを当てると、その計算根拠と参照しているマスタ値を表示する。

```
┌─────────────────────────────────────────┐
│ B 経費関係                                │
│ ┌────────────────────────────────┐ │
│ │ 1 労災保険料        [¥9,865]  ⓘ │ │ ← ⓘにホバー
│ └────────────────────────────────┘ │
│        ┌─────────────────────────┐    │
│        │ 計算根拠:                │    │
│        │ 工事価格 ¥5,000,000     │    │
│        │ × 0.1973%（労災保険率）  │    │
│        │ = ¥9,865                │    │
│        │                          │    │
│        │ [マスタを確認]           │    │
│        └─────────────────────────┘    │
└─────────────────────────────────────────┘
```

### S05-B 顧客提出価格試算表セクション

QCDS画面の下部に「顧客提出価格試算表」セクションを追加：

```
┌─ 顧客提出価格試算表 ──────────────────┐
│ 工事原価: ¥4,000,000（自動計算）        │
│                                       │
│ ┌────┬──────────┬───────────┐    │
│ │実行比率│利益率    │顧客提示価格│    │
│ ├────┼──────────┼───────────┤    │
│ │103%│粗利益0%  │¥4,120,000│    │
│ │100%│営業利益0%│¥4,000,000│    │
│ │ 99%│営業利益1%│¥4,040,404│    │
│ │ 98%│営業利益2%│¥4,081,633│ ◉ │ ← デフォルト選択
│ │ 97%│営業利益3%│¥4,123,711│    │
│ └────┴──────────┴───────────┘    │
│                                       │
│ [選択した価格を見積書に反映]           │
└────────────────────────────────────┘
```

### S16 管理画面（マスタ管理）

設計書 Part1 で記載した `/admin` 画面を以下のサブメニューに整理：

```
管理メニュー
├─ ユーザー管理
├─ 業務マスタ
│   ├─ 契約印紙税テーブル
│   ├─ 領収書印紙税テーブル
│   ├─ 保険料率
│   ├─ 事業部経費率
│   ├─ 人件費単価
│   ├─ 営業利益逆算テーブル
│   └─ QCDS適用条件（注釈）
├─ 見積条件文マスタ
├─ 基本契約約款マスタ
└─ システム設定
```

各マスタ画面は共通のCRUDテンプレートで実装：

```
┌─ 保険料率マスタ ────────────────────────┐
│ 適用日: [2026/04/01]  [+ 新しい版を作成]│
│                                        │
│ ┌──────────┬────┬──────┬────────┐ │
│ │保険種別  │率   │基準  │適用条件│ │
│ ├──────────┼────┼──────┼────────┤ │
│ │労災保険  │0.1973%│工事価格│元請のみ│ │
│ │工事保険  │0.2095%│請負金 │元請のみ│ │
│ │設備生産物│0.0110%│請負金 │設備工事│ │
│ │解体賠責  │1.8053%│個別   │解体工事│ │
│ └──────────┴────┴──────┴────────┘ │
│                                        │
│ [編集] [履歴を見る]                    │
└────────────────────────────────────┘
```

**版管理**：`effective_from` で版を管理し、過去案件は当時のマスタ値で再計算可能にする。

---

## 5. 実装手順（Phase 1への組み込み）

設計書 Part2 の以下のStepに以下を追加：

### Step 1-5（DBスキーマとAlembic）への追加

シードデータに以下を追加：

```python
# backend/scripts/seed.py に追加
def seed_business_master(db):
    # 印紙税テーブル（契約・領収書）
    db.bulk_save_objects([
        StampTaxTable(tax_type='contract', min_amount=0, max_amount=9999, tax_amount=0, effective_from=date(2024, 4, 1)),
        StampTaxTable(tax_type='contract', min_amount=10000, max_amount=2000000, tax_amount=200, effective_from=date(2024, 4, 1)),
        # ...全行
        StampTaxTable(tax_type='receipt', min_amount=0, max_amount=49999, tax_amount=0, effective_from=date(2024, 4, 1)),
        # ...全行
    ])
    # 保険料率
    db.bulk_save_objects([
        InsuranceRate(insurance_code='labor', rate=Decimal('0.001973'), base='project_price',
                      applicable_to='prime_contractor_only', is_default_required=True,
                      direct_input_threshold=Decimal('180000000'), effective_from=date(2024, 4, 1)),
        # ...
    ])
    # 事業部経費率、人件費単価、営業利益逆算テーブルも同様
```

### Step 2-4（QCDS実装）への追加

QCDS実装の後半に Step 2-4b として追加：

#### Step 2-4b：自動計算マスタ統合
- 印紙税自動算定サービス（契約用・領収書用）
- 保険料自動算定サービス
- 事業部経費自動算定サービス
- QCDS全体派生計算サービス
- 計算根拠の透明化UI（ⓘホバー）
- 顧客提出価格試算表UI

### Step 4-3（印紙税表管理）の拡張

既存の Step 4-3 を「業務マスタ管理」に拡張：

#### Step 4-3（業務マスタ管理）
- /admin/business-master に統合UI
- 各マスタのCRUD（印紙税、保険料率、経費率、人件費単価、営業利益逆算）
- 版管理（effective_from）
- 編集履歴の表示

---

## 6. Claude Codeへの指示テンプレート

```
@CLAUDE.md @docs/02_設計書_Part1.md @docs/05_設計書_追補_QCDS業務マスタ.md
を読みました。

これから設計書追補「QCDS業務マスタ（自動計算ロジック）」を実装してください。

重要な前提：
現行Excelの「QCDS原価算定表」シートの右側エリア（30〜77列）に、
業務上の重要な計算ロジックと業務マスタが大量に埋め込まれています。
これらを業務マスタテーブル群として独立させ、管理画面から更新可能にします。

実装の順序：
1. データモデル（追補 2章）
   - stamp_tax_table（契約・領収書の統合）
   - insurance_rates
   - overhead_rates
   - labor_unit_prices
   - profit_calculation_table
   - qcds_business_rules
2. シードデータ（追補 5章）
   - Excelから抽出した既存マスタ値の投入
3. 自動計算サービス群（追補 3章）
   - 印紙税自動算定（契約・領収書）
   - 保険料自動算定（適用条件含む）
   - 顧客提出価格試算
   - QCDS全体派生計算
4. QCDS画面の計算根拠透明化UI（追補 4章）
   - 各セルにⓘアイコン、ホバーで計算根拠表示
5. 顧客提出価格試算表セクション
6. 管理画面：業務マスタCRUD（追補 4章 S16）

注意：
- マスタは必ず版管理（effective_from）。過去案件は当時のマスタで再計算可
- 計算根拠は必ずユーザーに見せる（透明性確保）
- 保険要否の条件分岐（元請/下請、設備/解体）を見落とさないこと

シードデータの数値は @data/qcds_master_seed.json から読み込みます（後で本人が用意）。
まずはマスタテーブルの定義とサンプル数行で動作確認してください。
```

---

## 7. リスクと注意事項

| リスク | 対策 |
|---|---|
| マスタ値の更新タイミング | 版管理（effective_from）でいつ変わったか追跡。過去案件は当時の値で固定 |
| 保険要否の判定ロジックが複雑 | 案件作成時に「元請/下請」「設備工事の有無」「解体工事の有無」を明示的に入力させる |
| Excel計算式と微妙にズレる可能性 | 既存案件1〜2件をExcelとWeb両方で計算し、結果が一致することを必ず検証 |
| 印紙税は法改正で変わる | 管理画面から版を追加できる設計。法改正時は「新しい版を作成」で対応 |
| 5,000万円以上の工事は別書式 | UIで警告表示。「この案件は5,000万円以上のためQCDS簡易版の対象外です」 |
| 工事原価1.8億円以上は直接入力 | 自動計算サービスが閾値超過を検知して「直接入力モード」に切替 |
| 人件費単価の新人（1年目）が未定義 | 本人に要確認。当面は2年目以降の単価で代用 |

---

## 8. テスト計画追加

### 単体テスト

- 印紙税テーブルの境界値（各帯の上限・下限）
- 保険料率の各条件分岐（元請/下請、設備/解体）
- 顧客提出価格試算（5パターン）
- マスタ版管理（過去日付で過去版が引かれること）

### 統合テスト

- 案件作成→QCDS自動生成→既存Excel案件と数値が一致すること
- マスタ値を更新→新規案件のデフォルト値が変わること
- マスタ値を更新→既存案件は影響を受けないこと（版管理）

### 受入テスト

- 現行Excel案件3〜5件を選び、Web版で同じ案件を再計算
- 全項目（直接工事費、現場経費、事業部経費、一般管理費、営業利益）が一致することを確認

---

## 9. 本人への確認事項

実装前に以下を確認したい：

1. **人件費単価の新人（1年目）の扱い**
   現行Excelに記載なし。1年目は計算対象外？それとも2年目と同じ60万円？

2. **工事部経費（共通）の0%初期値の理由**
   現行Excelで「0.0%（自動計算）」となっているが、案件ごとに手動設定？
   それとも常に0%で固定？

3. **5,000万円以上の工事の運用**
   QCDS簡易版は「5,000万円未満」が適用条件。5,000万円以上の場合は別書式があるはず。
   Web版でどう扱うか：
   - (a) 5,000万円以上の案件は警告だけ出して同じ画面で運用
   - (b) 別画面・別データモデルで管理
   - (c) Phase 2以降で対応

4. **目標営業利益率10%は固定？**
   現行Excelで「10%」が初期値だが、案件ごとに5%や15%にすることはある？

5. **領収書印紙税の自動算出タイミング**
   請求書発行時？入金時？それとも参考表示だけ？

---

以上、QCDS業務マスタの追補設計。
