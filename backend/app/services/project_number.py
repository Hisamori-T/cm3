"""工事番号自動採番サービス。

後方互換 re-export: 新しいパスは app.shared.services.project_number
既存コードはそのまま from app.services.project_number import generate_project_number で動作する。
"""
from app.shared.services.project_number import generate_project_number  # noqa: F401

__all__ = ["generate_project_number"]
