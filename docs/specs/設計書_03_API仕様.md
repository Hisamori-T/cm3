# Construction Manager v3 — API仕様書

**ベースURL**: `https://cmv3.fact-ally.com/api/v1`  
**認証**: `Authorization: Bearer {access_token}` ヘッダー必須（login/refresh 以外）  
**Content-Type**: `application/json`

---

## 共通レスポンス形式

### エラーレスポンス
```json
{ "detail": "エラーメッセージ" }
// または
{ "detail": [{ "type": "...", "loc": [...], "msg": "..." }] }
```

### ページネーション
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

## 1. 認証 (/api/v1/auth)

### POST /auth/login
```
Request:  { "email": "user@example.com", "password": "password" }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

### POST /auth/refresh
```
Request:  { "refresh_token": "..." }
Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

### POST /auth/logout
```
Request:  { "refresh_token": "..." }
Response: 204 No Content
```

### GET /auth/me
```
Response: { "id": "uuid", "email": "...", "full_name": "...", "role": "...", "department": "..." }
```

### PATCH /auth/me
```
Request:  { "full_name"?, "department"?, "current_password"?, "new_password"? }
Response: UserRead
```

### GET /auth/users
```
// 全認証済みユーザー一覧（承認依頼先選択用）
Response: [{ "id": "uuid", "full_name": "...", "department": "..." }, ...]
```

---

## 2. 案件管理 (/api/v1/projects)

### GET /projects
```
Query: page=1&limit=20&status=in_progress&q=検索ワード&sales_person_id=uuid
Response: {
  "items": [ProjectListItem],
  "total": 100
}
```

**ProjectListItem**:
```json
{
  "id": "uuid",
  "project_number": "26-1-001",
  "project_name": "○○工事",
  "client_name": "株式会社○○",
  "status": "in_progress",
  "sales_person_name": "平等 久盛",
  "project_price": 3000000,
  "created_at": "2026-05-01T..."
}
```

### POST /projects
```
Request: {
  "project_name": "○○工事",           // 必須
  "project_location"?: "福井県...",
  "client_name"?: "株式会社○○",
  "client_id"?: "uuid",               // 顧客マスタ連携
  "sales_person_id"?: "uuid",
  "construction_person_id"?: "uuid"
}
Response: ProjectDetail (201 Created)
// 自動実行: 工事番号採番 / Quote + QuoteVersion(版1) 自動生成
```

### GET /projects/{project_id}
```
Response: ProjectDetail
```

**ProjectDetail**:
```json
{
  "id": "uuid",
  "project_number": "26-1-001",
  "project_name": "○○工事",
  "project_location": "福井県...",
  "client_name": "株式会社○○",
  "client_id": "uuid",
  "status": "in_progress",
  "project_price": 3000000,
  "period_quote_start": "2026-05-01",
  "period_actual_start": "2026-05-10",
  "order_type": "private",
  "contract_type": "prime",
  "payment_condition": "月末締...",
  "sales_person_name": "...",
  "construction_person_name": "...",
  "counts": {
    "qcds": 1,
    "quote": 1,
    "estimate": 3,
    "order": 1,
    "acknowledgment": 1,
    "invoice": 0,
    "progress": 12,
    "history": 45
  },
  "created_at": "..."
}
```

### PATCH /projects/{project_id}
```
Request: { 更新したいフィールドのみ }
Response: ProjectDetail
```

### POST /projects/{project_id}/status
```
Request:  { "status": "ordered" }
Response: ProjectDetail
// edit_histories に変更履歴を自動記録
```

### DELETE /projects/{project_id}
```
Response: 204 No Content
// 論理削除（deleted_at = now()）
```

### GET /projects/{project_id}/history
```
Query: page=1&limit=30
Response: { "items": [EditHistoryItem], "total": 100 }
```

---

## 3. 見積書 (/api/v1/projects/{project_id}/quotes)

### GET /projects/{project_id}/quotes
```
Response: [QuoteListItem]
```

### GET /projects/{project_id}/quotes/{quote_id}
```
Response: QuoteDetail
```

**QuoteDetail**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "quote_number": "26-1-001-Q1",
  "status": "draft",
  "subtotal": 1000000,
  "tax_amount": 100000,
  "total_amount": 1100000,
  "discount_amount": 0,
  "versions": [QuoteVersionRead],
  "sections": [QuoteSectionRead],
  "items": [QuoteItemRead],
  "condition_items": [QuoteConditionItemRead],
  "person_in_charge_id": "uuid",
  "reviewer_id": "uuid",
  "approver_id": "uuid",
  "approved_at": null
}
```

### PATCH /projects/{project_id}/quotes/{quote_id}
```
Request: { "issue_date"?, "period_start"?, "period_end"?, "payment_condition"?, ... }
Response: QuoteDetail
```

### POST /projects/{project_id}/quotes/{quote_id}/approve
```
// 稟議承認スタンプ押印（承認ワークフローとは別の簡易押印）
Request:  { "stamp_type": "person_in_charge" | "reviewer" | "approver", "user_id": "uuid" }
Response: QuoteDetail
```

---

## 4. 見積版管理 (/api/v1/projects/{project_id}/quotes/{quote_id}/versions)

### GET .../versions
```
Response: [QuoteVersionRead]
```

### POST .../versions
```
Request: { "vendor_id"?: "uuid", "markup_rate"?: 1.0, "version_no"?: 1 }
Response: QuoteVersionRead (201)
```

### PATCH .../versions/{version_id}
```
Request: { "markup_rate"?: 1.1, "is_active"?: true }
Response: QuoteVersionRead
```

### DELETE .../versions/{version_id}
```
Response: 204 No Content
```

### POST .../versions/{version_id}/reflect-to-qcds
```
// 版の明細を QCDS の直接工事費に反映
Response: QCDSResponse
```

### POST .../versions/{version_id}/import-items
```
Request: { "scan_result_id": "uuid" }
Response: QuoteVersionRead
// スキャン解析結果を版の明細に一括インポート
```

---

## 5. 大項目セクション (.../sections)

### GET .../sections
```
Response: [QuoteSectionRead]
```

### POST .../sections
```
Request: { "section_letter": "A", "section_name": "仮設工事", "row_no": 0 }
Response: QuoteSectionRead (201)
```

### PATCH .../sections/{section_id}
```
Request: { "section_name"?, "row_no"?, "amount"? }
Response: QuoteSectionRead
```

### DELETE .../sections/{section_id}
```
Response: 204 No Content
```

---

## 6. QCDS (/api/v1/projects/{project_id}/qcds)

### GET /projects/{project_id}/qcds
```
// 最新リビジョン取得（なければ自動作成）
Response: QCDSResponse
```

**QCDSResponse**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "revision": 0,
  "direct_works": [QCDSDirectWorkRead],
  "expense_items": [QCDSExpenseItemRead],
  "calc": {
    "direct_cost_budget": 2350000,
    "direct_cost_agreed": 2110000,
    "site_overhead_total": 35000,
    "operating_profit": 315000,
    "operating_profit_rate": 0.105,
    ...
  }
}
```

### PUT /projects/{project_id}/qcds
```
// 全30行を一括保存
Request: {
  "direct_works": [{ "row_no": 1, "work_type": "仮設", "vendor_id": "uuid",
    "budget_amount": 500000, "agreed_amount": 450000, ... }],
  "expense_items": [...],
  "labor_insurance_rate": 0.001973,
  "office_supplies": 2000, ...
}
Response: QCDSResponse
```

### PATCH /projects/{project_id}/ledger/direct-works/{work_id}
```
// 工事台帳画面から取決金額・チェック・月別支払を個別更新
Request: { "agreed_amount"?, "agreement_checked"?, "payment_month_4"?, ... }
Response: LedgerDirectWorkRead
```

---

## 7. 注文書 (/api/v1/projects/{project_id}/orders)

### GET /projects/{project_id}/orders
```
Response: [OrderRead]
```

### POST /projects/{project_id}/orders
```
Request: {
  "issue_date"?: "2026-05-08",
  "client_company"?: "福井配管工業 株式会社",
  "client_person"?: "田中 一郎 課長",
  "client_address"?: "福井県...",
  "amount_excl_tax"?: 1127273,
  "construction_period_start"?: "2026-05-10",
  "construction_period_end"?: "2026-07-20",
  "payment_condition"?: "月末締・翌月末払（現金）",
  "work_content"?: "SUS304 配管工事 一式",
  "notes"?: "備考",
  "terms_and_conditions"?: "約款テキスト"
}
Response: OrderRead (201)
```

**OrderRead**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "order_number": "26-OR-014-01",
  "status": "draft",
  "issue_date": "2026-05-08",
  "client_company": "福井配管工業 株式会社",
  "client_person": "田中 一郎 課長",
  "amount_excl_tax": 1127273,
  "tax_amount": 112727,
  "total_amount": 1240000,
  "stamp_tax": 400,
  "construction_period_start": "2026-05-10",
  "construction_period_end": "2026-07-20",
  "work_content": "...",
  "payment_condition": "月末締...",
  "terms_and_conditions": "...",
  "linked_to_quote": false,
  "created_at": "..."
}
```

### PATCH /projects/{project_id}/orders/{order_id}
```
Request: { 更新フィールドのみ }
Response: OrderRead
// status を "sent" に変更すると注文請書を自動発行
```

### DELETE /projects/{project_id}/orders/{order_id}
```
Response: 204 No Content
```

### POST /projects/{project_id}/orders/{order_id}/issue-acknowledgment
```
// 注文請書を発行（ドラフト作成して project に紐付け）
Response: AcknowledgmentRead (201)
```

### GET /projects/{project_id}/orders/{order_id}/export
```
Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### GET /projects/{project_id}/orders/{order_id}/export-pdf
```
Response: application/pdf
```

---

## 8. 注文請書 (/api/v1/projects/{project_id}/acknowledgments)

### GET /projects/{project_id}/acknowledgments
```
Response: [AcknowledgmentRead]
```

### PATCH /api/v1/acknowledgments/{ack_id}
```
Request: { "issue_date"?, "client_company"?, ..., "status"? }
Response: AcknowledgmentRead
```

### DELETE /api/v1/acknowledgments/{ack_id}
```
Response: 204 No Content
```

### GET /api/v1/acknowledgments/{ack_id}/export-pdf
```
Response: application/pdf
```

### GET /api/v1/acknowledgments/{ack_id}/export
```
Response: application/vnd.openxmlformats... (Excel)
```

---

## 9. 請求書 (/api/v1/projects/{project_id}/invoices)

### GET /projects/{project_id}/invoices
```
Response: [InvoiceRead]
```

### POST /projects/{project_id}/invoices
```
Request: { "issue_date"?, "current_purchase"?, "billing_method"?, "items"?: [] }
Response: InvoiceRead (201)
```

**InvoiceRead** (主要フィールド):
```json
{
  "id": "uuid",
  "invoice_number": "26-1-001-請1",
  "status": "draft",
  "issue_date": "2026-06-30",
  "current_purchase": 1000000,
  "tax_amount": 100000,
  "total_amount": 1100000,
  "billing_method": "direct_amount",
  "payment_due_date": "2026-07-31",
  "payments": [PaymentRead],
  "items": [InvoiceItemRead]
}
```

### PATCH /projects/{project_id}/invoices/{invoice_id}
```
Request: { 更新フィールド, "status"? }
Response: InvoiceRead
```

### POST /projects/{project_id}/invoices/{invoice_id}/payments
```
// 入金記録追加 → 全額入金で paid / 部分で partially_paid に自動遷移
Request: { "amount": 500000, "payment_date": "2026-07-25", "payment_method": "振込", "note"?: "..." }
Response: PaymentRead (201)
```

### DELETE /projects/{project_id}/invoices/{invoice_id}/payments/{payment_id}
```
Response: 204 No Content
// 削除後にステータスを自動再計算
```

### GET /projects/{project_id}/invoice-summary
```
Response: {
  "project_id": "uuid",
  "invoice_count": 2,
  "total_billed": 2000000,
  "total_paid": 1000000,
  "outstanding": 1000000,
  "latest_due_date": "2026-08-31"
}
// project_invoice_summary ビューから返却
```

---

## 10. 工事台帳 (/api/v1/projects/{project_id}/ledger)

### GET /projects/{project_id}/ledger
```
// 工事台帳全データを集約して返す
// 初回アクセス時に project_ledger_meta と ledger_approvals を自動作成
Response: LedgerResponse
```

**LedgerResponse** (主要フィールド):
```json
{
  "project_id": "uuid",
  "project_number": "26-1-001",
  "project_name": "○○工事",
  "project_price": 3000000,  // 注文請書があれば注文請書金額を優先
  // 顧客見積（案件チェックボックス）
  "quote_number": "26-Q-001",
  "quote_issue_date": "2026-01-22",
  "quote_total_amount": 3244692,
  // 注文請書（受注チェックボックス）
  "ack_number": "26-ACK-001",
  "ack_issue_date": "2026-05-12",
  "ack_total_amount": 3000000,
  // 工事割出（QCDS計算値）
  "cost_summary": {
    "direct_cost_budget": 2350000,
    "direct_cost_agreed": 2110000,
    "site_overhead_total": 35000,
    "operating_profit": 315000
  },
  // 現場経費6項目（QCDS + expense_overrides）
  "expense_items": [
    { "system_key": "stamp_tax", "item_name": "契約印紙代",
      "computed_amount": 0, "override_amount": 5000, "display_amount": 5000 },
    { "system_key": "labor_insurance", "item_name": "労災保険料",
      "computed_amount": 6555, "override_amount": null, "display_amount": 6555 },
    ...
  ],
  // 表4（直接工事費行）
  "direct_works": [
    { "id": "uuid", "row_no": 1, "vendor_name": "HIT", "work_type": "仮設",
      "budget_amount": 500000, "agreed_amount": 450000,
      "agreement_checked": false, "payment_completed": false,
      "monthly_payments": {"4": 250000, "5": null, ..., "9": 200000} }
  ],
  // 承認枠4つ
  "approvals": [
    { "role_label": "社長", "approver_name": null, "approved_at": null,
      "approver_user_id": null, "requested_by_name": null, "requested_at": null }
  ]
}
```

### PATCH /projects/{project_id}/ledger/meta
```
Request: {
  "original_client_name"?: "元発注者名",
  "project_summary"?: "工事概要テキスト",
  "information_history"?: "情報経緯",
  "client_requirements"?: "発注者要望",
  "payment_condition"?: "支払条件",
  "period_actual_start"?: "2026-05-10",
  "period_actual_end"?: "2026-07-20",
  "prev_construction_year"?: 2024,
  "prev_construction_other"?: "他社名",
  "prev_construction_self"?: true,
  "target_profit_rate"?: 10.0,
  "target_profit_amount"?: 300000,
  "expense_overrides"?: { "stamp_tax": 5000, "labor_insurance": null }
  // expense_overrides: マージ更新（null を渡すとキーを削除）
}
Response: LedgerResponse
```

### POST /projects/{project_id}/ledger/request-approve
```
// 承認枠への押印依頼送信（通知も送信）
Request: { "role_label": "社長", "approver_user_id": "uuid" }
Response: LedgerApprovalRead (200)
```

### POST /projects/{project_id}/ledger/approve
```
// 実際の押印（approver_user_id に指定されたユーザーまたは admin のみ）
Request: { "role_label": "担当", "comment"?: "..." }
Response: LedgerApprovalRead (200)
```

### DELETE /projects/{project_id}/ledger/approve/{role_label}
```
// 押印取消（admin または押印者本人のみ）
Response: 204 No Content
// 押印情報・依頼情報を全てクリア
```

---

## 11. スキャン・AI解析 (/api/v1/scan)

### POST /scan/upload
```
Content-Type: multipart/form-data
Body: file=<PDF|Excel|PNG|JPEG, max 20MB>, project_id=<uuid optional>
Response: { "job_id": "uuid", "status": "pending" } (202 Accepted)
// Celery ワーカーで非同期処理（pending→processing→succeeded/failed）
```

### GET /scan/jobs
```
Query: project_id?, status?, page=1, limit=20
Response: [ScanJobRead]
```

### GET /scan/jobs/{job_id}
```
Response: ScanJobRead (results 含む)
```

### PATCH /scan/results/{result_id}
```
// 解析結果の業者名・明細を修正
Request: { "vendor_id"?: "uuid", "vendor_name"?: "...", "items"?: [...] }
Response: ScanResultRead
```

### POST /scan/results/{result_id}/confirm
```
Response: ScanResultRead
```

### POST /scan/results/{result_id}/transfer-to-qcds
```
// 解析結果を QCDS の直接工事費に転記
Request: { "qcds_id": "uuid", "row_no_start": 1 }
Response: QCDSResponse
```

### POST /scan/results/{result_id}/save-as-version
```
// 解析結果を見積版として保存
Request: { "quote_id": "uuid", "markup_rate": 1.1 }
Response: QuoteVersionRead
```

### POST /scan/bulk-apply
```
Request: { "result_ids": ["uuid"], "target_type": "qcds"|"version", "target_id": "uuid" }
Response: { "applied_count": 3 }
```

---

## 12. 発注書 (/api/v1/projects/{project_id}/purchase-orders)

### GET /projects/{project_id}/purchase-orders
```
Response: [PurchaseOrderRead]
```

### POST /projects/{project_id}/purchase-orders
```
Request: {
  "vendor_id": "uuid",
  "qcds_direct_work_id"?: "uuid",
  "delivery_date"?: "2026-06-30",
  "payment_site"?: 60,
  "items": [{ "item_name": "配管", "spec": "25A", "quantity": 85, "unit": "m", "unit_price": 4500 }]
}
Response: PurchaseOrderRead (201)
// subtotal/tax_amount/total_amount は自動計算
```

### POST /projects/{project_id}/purchase-orders/{po_id}/issue
```
Response: PurchaseOrderRead
```

---

## 13. 業者出面 (/api/v1/projects/{project_id}/attendance)

### GET /projects/{project_id}/attendance
```
Query: year=2026&month=6
Response: [VendorAttendanceRead]
```

### POST /projects/{project_id}/attendance
```
Request: { "vendor_id": "uuid", "attendance_date": "2026-06-15", "worker_count": 3.5, "amount"?: 50000 }
Response: VendorAttendanceRead (201)
```

### GET /projects/{project_id}/attendance/summary
```
// 月次集計
Response: { "by_vendor": [{ "vendor_name": "...", "total_days": 15, "total_amount": 750000 }] }
```

---

## 14. 承認ワークフロー (/api/v1/approvals)

### GET /approvals/my
```
Response: {
  "pending_for_me": [ApprovalRequestRead],   // 自分が承認すべき
  "rejected_for_me": [...],                   // 差し戻された
  "requested_by_me": [...],                   // 自分が依頼中
  "completed": [...]                           // 完了済み
}
```

### POST /approvals
```
// 見積書の承認依頼送信
Request: {
  "quote_id": "uuid",
  "steps": [
    { "step_no": 1, "approver_id": "uuid" },  // 担当者（step1が自分なら自動承認）
    { "step_no": 2, "approver_id": "uuid" },  // 査閲
    { "step_no": 3, "approver_id": "uuid" }   // 承認者
  ]
}
Response: ApprovalRequestRead (201)
```

### POST /approvals/{request_id}/decide
```
Request: { "action": "approve"|"reject", "comment"?: "..." }
Response: ApprovalRequestRead
// 承認時: 次のステップへ通知、全承認完了で Quote スタンプ同期
```

---

## 15. ダッシュボード (/api/v1/dashboard)

### GET /dashboard
```
Response: {
  "kpis": {
    "total_projects": 128,
    "new_this_term": 23,
    "total_billed": 45000000,
    "completed_projects": 85
  },
  "status_distribution": [{ "status": "in_progress", "count": 15 }],
  "monthly_billing": [{ "year_month": "2026-05", "total": 8500000 }],
  "deadline_alerts": [...],
  "recent_activities": [...]
}
```

---

## 16. 管理画面 (/api/v1/admin)

### GET /admin/users
```
Response: [UserRead]
```

### POST /admin/users
```
Request: { "email": "...", "full_name": "...", "password": "...", "role": "staff", "employee_number"?: 5 }
Response: UserRead (201)
```

### PATCH /admin/users/{user_id}
```
Request: { "full_name"?, "role"?, "is_active"?, "department"? }
Response: UserRead
```

### GET/PATCH /admin/company-settings
```
// GET: 企業設定取得
// PATCH: 更新
Fields: { "company_name", "company_address", "company_phone", "slack_webhook_url" }
```

### GET/POST/PATCH/DELETE /admin/stamp-tax
```
// 印紙税テーブル管理
```

### GET/POST/PATCH/DELETE /admin/section-templates
```
// 大項目テンプレート管理
```

### GET/POST/PATCH/DELETE /admin/quote-conditions
```
// 見積条件テンプレート管理
```

---

## 17. 帳票エクスポート

全帳票は Bearer 認証必須。レスポンスは Content-Disposition: attachment。

| エンドポイント | 形式 | 用途 |
|---|---|---|
| GET /projects/{id}/quotes/{qid}/export | xlsx | 顧客見積書 |
| GET /projects/{id}/quotes/{qid}/export-pdf | pdf | 顧客見積書 PDF |
| GET /projects/{id}/orders/{oid}/export | xlsx | 注文書 |
| GET /projects/{id}/orders/{oid}/export-pdf | pdf | 注文書 PDF |
| GET /acknowledgments/{aid}/export | xlsx | 注文請書 |
| GET /acknowledgments/{aid}/export-pdf | pdf | 注文請書 PDF |
| GET /projects/{id}/invoices/{iid}/export | xlsx | 請求書 |
| GET /projects/{id}/invoices/{iid}/export-pdf | pdf | 請求書 PDF |

---

## 18. 通知 (/api/v1/notifications)

### GET /notifications
```
Query: unread_only=true&limit=20
Response: [NotificationRead]
```

### GET /notifications/unread-count
```
Response: { "count": 3 }
```

### PATCH /notifications/{id}/read
```
Response: 204 No Content
```
