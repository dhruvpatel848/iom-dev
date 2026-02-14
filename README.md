# Investigation Management System MVP

## Overview
This is a web-based application for managing medical insurance investigation cases. It allows investigating officers to create cases, enter structured data once, and generate professional investigation reports using customizable templates.

## Features
- ✅ User management (Admin & Officer roles)
- ✅ Case creation with auto-generated IDs
- ✅ Structured data entry (Patient, Hospital, Policy, Investigation)
- ✅ Document upload & management
- ✅ Commission tracking
- ✅ Customizable report templates (Admin)
- ✅ Automated report generation
- ✅ Case status management & closure
- ✅ Role-based access control

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: MySQL + Sequelize ORM
- **Frontend**: EJS Templates + Bootstrap 5
- **Session**: express-session
- **File Upload**: Multer
- **Authentication**: bcryptjs

## Prerequisites
- Node.js 18+ installed
- MySQL 5.7+ or MySQL 8+ installed and running
- Git (optional)

## Installation

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Configure Database
1. Create a MySQL database:
```sql
CREATE DATABASE investigation_system;
```

2. Update the `.env` file with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=investigation_system
DB_PORT=3306
```

### 3. Initialize Database
Run the database initialization script to create tables and seed initial data:
```bash
npm run init-db
```

This will:
- Create all required database tables
- Create a default admin user (admin@investigation.com / admin123)
- Create a sample report template for ICICI Lombard

## Running the Application

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at: **http://localhost:3000**

## Default Login Credentials
- **Email**: admin@investigation.com
- **Password**: 123456

⚠️ **IMPORTANT**: Change the default admin password immediately after first login!

## Usage Guide

### For Admin Users
1. **User Management**: Create officers and additional admin users
2. **Template Management**: Create report templates for different insurance companies
3. **Full Access**: View and edit all cases (including closed ones)

### For Investigating Officers
1. **Create Case**: Start a new investigation with auto-generated case ID
2. **Enter Data**: Fill patient, hospital, policy, investigation details (tabbed interface)
3. **Upload Documents**: Attach bills, records, ID proofs, etc.
4. **Track Commission**: Enter commission details and payment status
5. **Generate Report**: Select template, add conclusion/recommendation, download
6. **Close Case**: Mark case as closed (becomes read-only)

## Project Structure
```
├── config/          # Database and session configuration
├── middleware/      # Authentication and file upload middleware
├── models/          # Sequelize database models
├── routes/          # Express route handlers
├── views/           # EJS templates
│   ├── layouts/     # Page layouts
│   ├── auth/        # Login pages
│   ├── cases/       # Case management views
│   ├── reports/     # Report generation views
│   └── admin/       # Admin panel views
├── storage/         # File storage
│   ├── uploads/     # Uploaded documents
│   └── reports/     # Generated reports
├── .env             # Environment configuration
├── server.js        # Application entry point
├── init-db.js       # Database initialization script
└── package.json     # Dependencies
```

## Environment Variables
```env
PORT=3000                    # Server port
NODE_ENV=development         # Environment
DB_HOST=localhost           # MySQL host
DB_USER=root                # MySQL username
DB_PASSWORD=                # MySQL password
DB_NAME=investigation_system # Database name
DB_PORT=3306                # MySQL port
SESSION_SECRET=your-secret  # Session encryption key
JWT_SECRET=your-jwt-secret  # JWT signing key
MAX_FILE_SIZE=10485760      # Max upload size (10MB)
```

## MVP Constraints (As Per Requirements)
✅ No AI/OCR integration
✅ No microservices - Simple monolithic architecture
✅ No event-driven architecture
✅ No premature optimization
✅ No unnecessary dashboards - Form-driven UI
✅ Local file storage (no S3)

## Success Criteria
- [x] Officer can finish report without Microsoft Word
- [x] Data is entered once and reused across system
- [x] Commission is clearly tracked per case
- [x] Admin can easily change report formats via templates
- [x] Report output is professional and submission-ready
- [x] Workflow is faster than Word-based process

## Troubleshooting

### Database Connection Error
- Ensure MySQL is running
- Verify credentials in `.env` file
- Check that database `investigation_system` exists

### Port Already in Use
- Change PORT in `.env` file
- Or stop process using port 3000:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

### File Upload Errors
- Ensure `storage/uploads` directory exists and has write permissions
- Check MAX_FILE_SIZE in `.env`

## License
Proprietary - For internal use only

## Support
For issues or questions, contact the development team.
