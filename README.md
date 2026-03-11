# Power BI Embed Portal (Vite + Python + Postgres)

Simple starter app for:
- Login/logout
- User roles (`admin`, `user`)
- Admin-managed report catalog
- Per-user access control to specific reports
- Power BI embedded report hosting

## Stack
- Frontend: Vite + React
- Backend: FastAPI + SQLAlchemy
- Database: Postgres

## Docker (Local + Droplet)

### Files added for containerized deploy
- `docker-compose.yml` (frontend + backend + postgres)
- `frontend/Dockerfile` (builds Vite app, serves via nginx)
- `frontend/nginx.conf` (serves SPA and proxies API routes to backend)
- `backend/Dockerfile` (runs FastAPI with uvicorn)
- `.env.example` (compose/runtime config template)

### 1) Configure env

From repo root:

```bash
cp .env.example .env
```

Set at minimum:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `COOKIE_SECURE=true` when using HTTPS

### 2) Build and run

From repo root:

```bash
docker compose up -d --build
```

App will be available at:
- `http://<host-ip-or-domain>:80` (or whatever `APP_PORT` is set to)

### 3) Logs and lifecycle

```bash
docker compose logs -f
docker compose ps
docker compose down
```

## Deploy to a DigitalOcean Droplet

Assumes Ubuntu 24.04 and a fresh droplet.

### 1) Install Docker + Compose plugin

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
```

### 2) Pull project and configure env

```bash
git clone <your-repo-url>
cd MI
cp .env.example .env
nano .env
```

### 3) Start app

```bash
sudo docker compose up -d --build
sudo docker compose ps
```

### 4) Open firewall port

In DigitalOcean Networking/Firewall, allow inbound:
- TCP `80` (and `443` if you add TLS later)

### 5) Update deployments

```bash
git pull
sudo docker compose up -d --build
```

## Project Structure
- `backend/`: FastAPI API and auth/access logic
- `frontend/`: Vite React UI

## 1) Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Create a Postgres DB, for example:

```sql
CREATE DATABASE powerbi_portal;
```

Set `DATABASE_URL` in `backend/.env` if needed.

Run backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Default seeded admin (from `.env`):
- email: `admin@example.com`
- password: `ChangeMe123!`

## 2) Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```bash
VITE_API_BASE=http://localhost:8000
```

Run frontend:

```bash
npm run dev
```

Open `http://localhost:5173`.

## Notes on Power BI Embed
- Add reports as admin in the app UI (`name`, `report_id`, `embed_url`, optional `embed_token`).
- `embed_token` is needed for report rendering with this starter.
- In production, embed tokens should be generated server-side per request and rotated (do not persist long-lived tokens in DB).

## Key API Endpoints
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /reports`
- `GET /admin/users`
- `POST /admin/users`
- `POST /admin/reports`
- `PUT /admin/users/{user_id}/report-access`
# MI
# MI
