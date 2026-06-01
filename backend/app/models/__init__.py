"""SQLAlchemy モデルの一括インポート。Alembic の autogenerate に必要。"""
from app.models.company_settings import CompanySettings as CompanySettings
from app.models.acknowledgment import Acknowledgment as Acknowledgment
from app.models.attendance import VendorAttendance as VendorAttendance
from app.models.client import Client as Client, ClientContact as ClientContact, ClientSite as ClientSite
from app.models.comment import ProjectComment as ProjectComment, ProjectCommentAttachment as ProjectCommentAttachment
from app.models.daily_report import DailyReport as DailyReport, DailyReportAttachment as DailyReportAttachment, DailyReportEntry as DailyReportEntry
from app.models.gantt import ProjectTask as ProjectTask, WorkTypeMaster as WorkTypeMaster
from app.models.history import EditHistory as EditHistory
from app.models.invoice import Invoice as Invoice, InvoiceItem as InvoiceItem, Payment as Payment
from app.models.master import ProjectNumberSequence as ProjectNumberSequence, StampTaxTable as StampTaxTable
from app.models.order import Order as Order
from app.models.progress import ProgressAttachment as ProgressAttachment, ProgressLog as ProgressLog
from app.models.project import Project as Project
from app.models.purchase import PurchaseOrder as PurchaseOrder, PurchaseOrderItem as PurchaseOrderItem, VendorDelivery as VendorDelivery
from app.models.qcds import QCDS as QCDS, QCDSDirectWork as QCDSDirectWork
from app.models.quote import Quote as Quote, QuoteItem as QuoteItem
from app.models.schedule import ScheduleEvent as ScheduleEvent, ScheduleEventAttendee as ScheduleEventAttendee
from app.models.section_template import SectionTemplate as SectionTemplate, SectionTemplateItem as SectionTemplateItem
from app.models.scan import ScanJob as ScanJob, ScanResult as ScanResult, ScanResultItem as ScanResultItem
from app.models.user import User as User
from app.models.vendor import Vendor as Vendor, VendorPriceHistory as VendorPriceHistory

__all__ = [
    "Acknowledgment",
    "Client",
    "ClientContact",
    "ClientSite",
    "DailyReport",
    "DailyReportAttachment",
    "DailyReportEntry",
    "EditHistory",
    "Invoice",
    "InvoiceItem",
    "Payment",
    "Order",
    "ProgressAttachment",
    "ProgressLog",
    "Project",
    "ProjectComment",
    "ProjectCommentAttachment",
    "ProjectNumberSequence",
    "ProjectTask",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "QCDS",
    "QCDSDirectWork",
    "Quote",
    "QuoteItem",
    "ScheduleEvent",
    "ScheduleEventAttendee",
    "SectionTemplate",
    "SectionTemplateItem",
    "ScanJob",
    "ScanResult",
    "ScanResultItem",
    "StampTaxTable",
    "User",
    "VendorAttendance",
    "VendorDelivery",
    "Vendor",
    "VendorPriceHistory",
    "WorkTypeMaster",
]
