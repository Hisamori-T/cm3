"""QCDS エンドポイント — re-export shim。

実装は modules/estimate/routers/qcds.py に移動済み。
"""
from app.modules.estimate.routers.qcds import router

__all__ = ["router"]
