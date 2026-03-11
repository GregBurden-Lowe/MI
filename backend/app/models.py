from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default='user')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    access_rows = relationship('UserReportAccess', back_populates='user', cascade='all, delete-orphan')

    __table_args__ = (CheckConstraint("role IN ('admin', 'user')", name='ck_user_role'),)


class Report(Base):
    __tablename__ = 'reports'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    report_id: Mapped[str] = mapped_column(String(255), unique=True)
    embed_url: Mapped[str] = mapped_column(String(2000))
    embed_token: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    dataset_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    access_rows = relationship('UserReportAccess', back_populates='report', cascade='all, delete-orphan')


class UserReportAccess(Base):
    __tablename__ = 'user_report_access'

    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey('reports.id', ondelete='CASCADE'), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='access_rows')
    report = relationship('Report', back_populates='access_rows')

    __table_args__ = (UniqueConstraint('user_id', 'report_id', name='uq_user_report_access'),)
