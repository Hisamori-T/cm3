"""Project モジュール: モデル re-export。

実体は app.models.project / app.models.comment にある。
将来的にはこのモジュールに実体を移動する。
"""
from app.models.project import Project  # noqa: F401
from app.models.comment import ProjectComment, ProjectCommentAttachment  # noqa: F401

__all__ = ["Project", "ProjectComment", "ProjectCommentAttachment"]
