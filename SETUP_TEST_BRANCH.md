# Setup Guide for Test Branch

This guide will help you set up the project from the **Test** branch in a fresh Cursor workspace, with proper database isolation to avoid conflicts with other branches.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Git** (for cloning/pulling the repository)
- **Docker** and **Docker Compose** (for backend services)
- **Node.js 18+** and **npm** (for frontend)
- **Cursor IDE** (or any IDE of your choice)

## 🚀 Step-by-Step Setup

### 1. Clone/Pull the Repository

#### Option A: If you're starting fresh (recommended)

```bash
# Clone the repository
git clone https://github.com/rehman845/BusinessPulse.git

# Navigate to the project directory
cd BusinessPulse

# Checkout the Test branch
git checkout Test
```

#### Option B: If you already have the repository

```bash
# Navigate to your existing project directory
cd path/to/BusinessPulse

# Fetch latest changes
git fetch origin

# Checkout the Test branch (create and track if it doesn't exist locally)
git checkout -b Test origin/Test

# If the branch already exists locally, just switch to it
git checkout Test

# Pull latest changes
git pull origin Test
```

### 2. Create Separate Database Volume (IMPORTANT!)

To avoid conflicts with other branches (like `main` or `AliChanges`), you need to create a separate Docker volume for the Test branch's database.

#### Step 2.1: Modify Docker Compose Configuration

Open `backend/infra/docker-compose.yml` and update the volume name:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: context_postgres
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: contextdb
    ports:
      - "5432:5432"
    volumes:
      - context_pgdata_test:/var/lib/postgresql/data  # Changed from context_pgdata_alichanges
    # ... rest of config

volumes:
  context_pgdata_test:  # Changed from context_pgdata_alichanges
```

**Note**: The volume name `context_pgdata_test` ensures complete isolation from other branches' databases.

#### Step 2.2: Stop Any Running Containers

If you have containers running from another branch, stop them first:

```bash
# Navigate to the docker-compose directory
cd backend/infra

# Stop and remove containers (this does NOT delete volumes)
docker-compose down
```

**Important**: `docker-compose down` does NOT delete volumes, so your data from other branches remains safe.

### 3. Backend Setup

#### Step 3.1: Configure Environment Variables

Create a `.env` file in the `backend` directory (if it doesn't exist):

```bash
cd backend
touch .env
```

Add the following environment variables to `backend/.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://app:app@localhost:5432/contextdb

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=your_pinecone_index_name
PINECONE_NAMESPACE=default

# Optional Settings
UPLOAD_DIR=app/storage/uploads
```

**Replace the placeholder values** with your actual API keys and configuration.

#### Step 3.2: Start Backend Services

```bash
# Make sure you're in the backend/infra directory
cd backend/infra

# Start all services (PostgreSQL, PgAdmin, Backend)
docker-compose up -d

# View logs to ensure everything started correctly
docker-compose logs -f backend
```

**What this does:**
- Creates a fresh PostgreSQL database with the `context_pgdata_test` volume
- Starts the backend API server
- Starts PgAdmin (database management tool)

#### Step 3.3: Run Database Migration (if needed)

If the Employee model has new fields (`hours_per_day`, `days_per_week`), you may need to run the migration script:

```bash
# Navigate to backend directory
cd backend

# Run the migration script
python -m app.scripts.migrate_add_employee_schedule_fields
```

**Note**: The database tables are automatically created on backend startup, but if you need to add columns to existing tables, use the migration script.

#### Step 3.4: Verify Backend is Running

- **API Health Check**: Open http://localhost:8001/health in your browser (should return `{"status": "ok"}`)
- **API Documentation**: Open http://localhost:8001/docs for Swagger UI
- **Check Logs**: `docker-compose logs backend` should show no errors

### 4. Frontend Setup

#### Step 4.1: Install Dependencies

```bash
# Navigate to frontend directory
cd crmDashboard-nextjs

# Install npm packages
npm install
```

#### Step 4.2: Configure Frontend Environment Variables

Create a `.env.local` file in the `crmDashboard-nextjs` directory:

```bash
cd crmDashboard-nextjs
touch .env.local
```

Add the following to `crmDashboard-nextjs/.env.local`:

```env
# Backend API URL (used server-side)
BACKEND_API_URL=http://127.0.0.1:8001

# Alternative backend URL variable
API_URL=http://127.0.0.1:8001

# Frontend app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Step 4.3: Start Frontend Development Server

```bash
# Make sure you're in the crmDashboard-nextjs directory
npm run dev
```

The frontend should start on **http://localhost:3000**

### 5. Verify Setup

#### 5.1: Check Backend Services

```bash
# Check if containers are running
docker ps

# You should see:
# - context_postgres (PostgreSQL)
# - businesspulse-backend (Backend API)
# - pgadmin (PgAdmin, optional)
```

#### 5.2: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **PgAdmin** (if enabled): http://localhost:5050

#### 5.3: Test Key Features

1. **Team Management**: Navigate to `/dashboard/team` and add an employee with schedule fields
2. **Billing**: Navigate to `/dashboard/billing` and add expenses
3. **Invoices**: Navigate to `/dashboard/invoices` and create invoices
4. **Revenue Breakdown**: Click on "Total Revenue" on the dashboard to see monthly breakdown

## 🔧 Troubleshooting

### Issue: Database Connection Errors

**Problem**: Backend can't connect to PostgreSQL

**Solutions**:
- Ensure Docker containers are running: `docker ps`
- Check if PostgreSQL container is healthy: `docker-compose ps`
- Verify `DATABASE_URL` in `backend/.env` matches Docker Compose settings
- Check backend logs: `docker-compose logs backend`

### Issue: Port Already in Use

**Problem**: Port 3000 (frontend) or 8001 (backend) is already in use

**Solutions**:

**For Frontend (port 3000)**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Mac/Linux
lsof -ti:3000 | xargs kill

# Or use a different port
npm run dev -- -p 3001
```

**For Backend (port 8001)**:
- Stop the conflicting container: `docker-compose down`
- Or change the port in `docker-compose.yml` (requires updating frontend `.env.local`)

### Issue: Database Volume Conflicts

**Problem**: Using the same database volume as another branch

**Solution**: 
- Ensure you've updated the volume name in `docker-compose.yml` to `context_pgdata_test`
- Run `docker-compose down -v` to remove old volumes (⚠️ **WARNING**: This deletes data!)
- Or simply use a different volume name as shown in Step 2.1

### Issue: Missing Environment Variables

**Problem**: Application errors about missing API keys

**Solution**:
- Verify `.env` file exists in `backend/` directory
- Verify `.env.local` exists in `crmDashboard-nextjs/` directory
- Check that all required variables are set (see Step 3.1 and 4.2)
- Restart services after adding environment variables

### Issue: Frontend Can't Connect to Backend

**Problem**: 404 errors or connection refused when accessing API

**Solutions**:
- Verify backend is running: `docker-compose ps`
- Check `BACKEND_API_URL` in `crmDashboard-nextjs/.env.local`
- Test backend directly: `curl http://localhost:8001/health`
- Check CORS settings (if needed)

### Issue: Migration Script Errors

**Problem**: Migration script fails or columns already exist

**Solution**:
- The script is idempotent - it checks if columns exist before adding them
- If columns already exist, the script will skip them (this is normal)
- For fresh databases, tables are created automatically on backend startup

## 📝 Important Notes

### Database Isolation

- **Each branch should use a different Docker volume** to avoid schema conflicts
- Volume names follow the pattern: `context_pgdata_<branchname>`
- Example: `context_pgdata_test`, `context_pgdata_alichanges`, `context_pgdata_main`
- Data in volumes persists even after `docker-compose down` (volumes are not deleted)

### Branch-Specific Configuration

If you're switching between branches:

1. **Stop containers**: `docker-compose down`
2. **Switch branches**: `git checkout <branch-name>`
3. **Update volume name** in `docker-compose.yml` if needed
4. **Start containers**: `docker-compose up -d`

### Data Persistence

- **Docker volumes persist data** across container restarts
- To start fresh: `docker-compose down -v` (⚠️ **deletes all data in volumes**)
- Individual volumes can be managed: `docker volume ls` and `docker volume rm <volume-name>`

## 🎯 Quick Reference Commands

```bash
# Navigate to project root
cd BusinessPulse

# Checkout Test branch
git checkout Test

# Start backend services
cd backend/infra
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# Stop backend services
docker-compose down

# Start frontend
cd crmDashboard-nextjs
npm run dev

# Run database migration
cd backend
python -m app.scripts.migrate_add_employee_schedule_fields

# Check Docker volumes
docker volume ls

# Check running containers
docker ps

# View container logs
docker-compose logs <service-name>
```

## 🔗 Useful Links

- **Repository**: https://github.com/rehman845/BusinessPulse
- **Test Branch**: https://github.com/rehman845/BusinessPulse/tree/Test
- **API Documentation**: http://localhost:8001/docs (after starting backend)
- **Frontend Application**: http://localhost:3000 (after starting frontend)

## 📞 Support

If you encounter issues not covered in this guide:

1. Check the main README.md for general project documentation
2. Review Docker logs: `docker-compose logs`
3. Check backend logs: `docker-compose logs backend`
4. Verify environment variables are set correctly
5. Ensure all prerequisites are installed

---

**Happy Coding! 🚀**
