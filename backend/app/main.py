from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .auth import COOKIE_NAME, create_access_token, get_current_user, hash_password, require_admin, verify_password
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .models import Report, User, UserReportAccess

app = FastAPI(title='Power BI Embed Portal API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserCreateRequest(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = 'user'

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError('Name fields cannot be blank')
        return stripped


class UserUpdateRequest(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    email: EmailStr
    role: str

    @field_validator('first_name', 'last_name')
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError('Name fields cannot be blank')
        return stripped


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ReportCreateRequest(BaseModel):
    name: str
    report_id: str
    embed_url: str
    embed_token: str | None = None
    dataset_id: str | None = None
    workspace_id: str | None = None


class ReportAccessUpdateRequest(BaseModel):
    report_ids: list[int]


def serialize_user(user: User) -> dict:
    return {
        'id': user.id,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'role': user.role,
        'must_change_password': user.must_change_password,
    }


def ensure_schema() -> None:
    inspector = inspect(engine)
    if 'users' not in inspector.get_table_names():
        return

    user_columns = {column['name'] for column in inspector.get_columns('users')}
    if 'first_name' not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN first_name VARCHAR(255) NOT NULL DEFAULT ''")
            )
    if 'last_name' not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN last_name VARCHAR(255) NOT NULL DEFAULT ''")
            )
    if 'must_change_password' not in user_columns:
        with engine.begin() as connection:
            connection.execute(
                text(
                    'ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE'
                )
            )


@app.on_event('startup')
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == settings.admin_email))
        if not existing:
            admin = User(
                first_name='Admin',
                last_name='User',
                email=settings.admin_email,
                password_hash=hash_password(settings.admin_password),
                role='admin',
                must_change_password=False,
            )
            db.add(admin)
            db.commit()


@app.post('/auth/login')
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    token = create_access_token(user)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite='lax',
        secure=settings.cookie_secure,
        max_age=settings.jwt_expire_minutes * 60,
    )

    return {'user': serialize_user(user)}


@app.post('/auth/logout')
def logout(response: Response, _user: User = Depends(get_current_user)):
    response.delete_cookie(COOKIE_NAME)
    return {'ok': True}


@app.get('/auth/me')
def me(user: User = Depends(get_current_user)):
    return {'user': serialize_user(user)}


@app.post('/auth/change-password')
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Current password is incorrect')

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'user': serialize_user(user)}


@app.get('/reports')
def list_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == 'admin':
        reports = db.scalars(select(Report).order_by(Report.id.desc())).all()
    else:
        reports = db.scalars(
            select(Report)
            .join(UserReportAccess, UserReportAccess.report_id == Report.id)
            .where(UserReportAccess.user_id == user.id)
            .order_by(Report.id.desc())
        ).all()

    return {
        'reports': [
            {
                'id': r.id,
                'name': r.name,
                'report_id': r.report_id,
                'embed_url': r.embed_url,
                'embed_token': r.embed_token,
                'dataset_id': r.dataset_id,
                'workspace_id': r.workspace_id,
            }
            for r in reports
        ]
    }


@app.get('/admin/users')
def list_users(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    result = []
    for user in users:
        access_rows = db.scalars(
            select(Report)
            .join(UserReportAccess, UserReportAccess.report_id == Report.id)
            .where(UserReportAccess.user_id == user.id)
            .order_by(Report.id.asc())
        ).all()
        result.append(
            {
                'id': user.id,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'role': user.role,
                'must_change_password': user.must_change_password,
                'report_access': [{'id': r.id, 'name': r.name} for r in access_rows],
            }
        )
    return {'users': result}


@app.post('/admin/users', status_code=201)
def create_user(payload: UserCreateRequest, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if payload.role not in ('admin', 'user'):
        raise HTTPException(status_code=400, detail='Role must be admin or user')

    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=409, detail='User already exists')

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'user': serialize_user(user)}


@app.put('/admin/users/{user_id}')
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.role not in ('admin', 'user'):
        raise HTTPException(status_code=400, detail='Role must be admin or user')

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    exists = db.scalar(select(User).where(User.email == payload.email, User.id != user_id))
    if exists:
        raise HTTPException(status_code=409, detail='User already exists')

    user.first_name = payload.first_name
    user.last_name = payload.last_name
    user.email = payload.email
    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    return {'user': serialize_user(user)}


@app.post('/admin/reports', status_code=201)
def create_report(payload: ReportCreateRequest, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    exists = db.scalar(select(Report).where(Report.report_id == payload.report_id))
    if exists:
        raise HTTPException(status_code=409, detail='Report already exists')

    report = Report(
        name=payload.name,
        report_id=payload.report_id,
        embed_url=payload.embed_url,
        embed_token=payload.embed_token,
        dataset_id=payload.dataset_id,
        workspace_id=payload.workspace_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        'report': {
            'id': report.id,
            'name': report.name,
            'report_id': report.report_id,
            'embed_url': report.embed_url,
            'embed_token': report.embed_token,
            'dataset_id': report.dataset_id,
            'workspace_id': report.workspace_id,
        }
    }


@app.delete('/admin/reports/{report_id}')
def delete_report(report_id: int, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail='Report not found')

    db.delete(report)
    db.commit()
    return {'ok': True, 'report_id': report_id}


@app.put('/admin/users/{user_id}/report-access')
def set_user_report_access(
    user_id: int,
    payload: ReportAccessUpdateRequest,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    db.query(UserReportAccess).filter(UserReportAccess.user_id == user_id).delete()

    if payload.report_ids:
        reports = db.scalars(select(Report).where(Report.id.in_(payload.report_ids))).all()
        if len(reports) != len(set(payload.report_ids)):
            raise HTTPException(status_code=400, detail='One or more report_ids are invalid')

        for report_id in sorted(set(payload.report_ids)):
            db.add(UserReportAccess(user_id=user_id, report_id=report_id))

    db.commit()

    access_rows = db.scalars(
        select(Report)
        .join(UserReportAccess, UserReportAccess.report_id == Report.id)
        .where(UserReportAccess.user_id == user_id)
        .order_by(Report.id.asc())
    ).all()
    return {'user_id': user_id, 'report_access': [{'id': r.id, 'name': r.name} for r in access_rows]}


@app.get('/health')
def health():
    return {'ok': True}
