"""アプリケーション全体で使用する Enum 定義。"""
import enum


class UserRole(str, enum.Enum):
    super_admin = "super_admin"  # システム管理者（最上位）
    admin = "admin"              # 管理者（社長・管理者）
    manager = "manager"          # 上長（確認承認権限あり）
    staff = "staff"              # 現場・営業
    legacy = "legacy"            # Excel専用（高齢者）
    accounting = "accounting"    # 経理（注文書・請求書の確認承認）
    member = "member"            # 後方互換（staff と同等）


class ProjectStatus(str, enum.Enum):
    quote = "quote"            # 見積中
    ordered = "ordered"        # 受注
    started = "started"        # 着工
    in_progress = "in_progress"  # 施工中
    completed = "completed"    # 完工
    billed = "billed"          # 請求済
    paid = "paid"              # 入金済


class OrderType(str, enum.Enum):
    private = "private"    # 民間
    government = "government"  # 官庁


class ContractType(str, enum.Enum):
    prime = "prime"    # 元請
    sub = "sub"        # 下請


class AwardingType(str, enum.Enum):
    special = "special"      # 特命
    competitive = "competitive"  # 競争


class PrevConstructionType(str, enum.Enum):
    own = "own"      # 当社
    other = "other"  # 他社
    none = "none"    # なし


class QCDSCategory(str, enum.Enum):
    subcontract = "subcontract"  # 外注
    material = "material"        # 資材
    other = "other"              # その他


class QuoteStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    approved = "approved"  # 全承認印完了時に自動設定


class OrderStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    signed = "signed"
    cancelled = "cancelled"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    partially_paid = "partially_paid"
    overdue = "overdue"
    cancelled = "cancelled"


class AcknowledgmentStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"


class ProgressLogType(str, enum.Enum):
    text = "text"
    photo = "photo"
    drawing = "drawing"
    milestone = "milestone"


class CanonSyncStatus(str, enum.Enum):
    local_only = "local_only"
    syncing = "syncing"
    synced = "synced"


class ScanJobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    succeeded = "succeeded"
    failed = "failed"
    reviewed = "reviewed"


class ScanJobFileType(str, enum.Enum):
    pdf = "pdf"
    image = "image"
    excel = "excel"


class EditHistoryChangeType(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"


class VendorPriceHistorySource(str, enum.Enum):
    scan = "scan"
    manual = "manual"


class ClientRank(str, enum.Enum):
    A = "A"
    B = "B"
    C = "C"


class BillingMethod(str, enum.Enum):
    direct_amount = "direct_amount"    # 金額直接指定
    percentage = "percentage"          # 見積額の割合（%）
    item_selection = "item_selection"  # 明細選択


class TaskStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    delayed = "delayed"


class TaskDependencyType(str, enum.Enum):
    finish_to_start = "finish_to_start"
    start_to_start = "start_to_start"
    finish_to_finish = "finish_to_finish"
    start_to_finish = "start_to_finish"


class WeatherType(str, enum.Enum):
    sunny = "sunny"
    cloudy = "cloudy"
    rainy = "rainy"
    snowy = "snowy"


class PhotoType(str, enum.Enum):
    before = "before"
    during = "during"
    after = "after"
    issue = "issue"
    drawing = "drawing"


class ScheduleEventType(str, enum.Enum):
    meeting = "meeting"
    site_visit = "site_visit"
    milestone = "milestone"
    personal = "personal"
    vendor_visit = "vendor_visit"


class ScheduleVisibility(str, enum.Enum):
    public = "public"
    private = "private"
    team = "team"


class AttendeeResponse(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class PurchaseOrderStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    partial_delivered = "partial_delivered"
    delivered = "delivered"
    completed = "completed"


class DeliveryStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    delivered = "delivered"


class PaymentMethod(str, enum.Enum):
    bank_transfer = "bank_transfer"
    promissory_note = "promissory_note"
    cash = "cash"


# ── Phase R-1: 出来高・控除・支払通知書 ─────────────────────────────────────

class ProjectRole(str, enum.Enum):
    """案件の立場（元請/下請/公共）。"""
    prime = "prime"    # 元請
    sub = "sub"        # 下請
    public = "public"  # 公共


class InvoicePhase(str, enum.Enum):
    """出来高請求フェーズ（下請フロー用）。"""
    advance = "advance"  # 前払
    interim = "interim"  # 中間
    partial = "partial"  # 部分
    final = "final"      # 完了・最終
    none = "none"        # 未指定


class DeductionType(str, enum.Enum):
    """控除種別（元請→下請 支払通知書用）。"""
    safety_fee = "safety_fee"               # 安全協力会費
    materials_advance = "materials_advance"  # 材料費立替
    parking_fee = "parking_fee"             # 駐車場代
    statutory_welfare = "statutory_welfare"  # 法定福利費
    other = "other"                         # その他
