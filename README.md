# Facility Reservation System (施設予約システム)

A production-ready web application for managing public facility room rentals and reservations with online payment integration.

## Features

- **Multi-room, Multi-date Reservations**: Book multiple rooms across multiple dates in a single application
- **Flexible Time Slots**: Morning (09:00-12:00), Afternoon (13:00-17:00), Evening (18:00-21:30)
- **Extension Blocks**: Optional midday (12:00-13:00) and evening (17:00-18:00) extensions
- **Dynamic Pricing**: Automatic price calculation based on entrance fees (1.0x, 1.5x, 2.0x multipliers)
- **Equipment Rental**: Comprehensive equipment catalog with per-slot and flat pricing
- **Air Conditioning Tracking**: Staff-entered actual usage hours for accurate billing
- **Online Payments**: Integration with payment providers (Stripe/Pay.jp)
- **User Management**: Email-verified user registration and authentication
- **Admin Dashboard**: Full management interface for staff
- **Cancellation Policy**: Automatic fee calculation (0% before date, 100% on/after date)

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MySQL 8.0 / MariaDB 10.11

### Frontend
- **Rendering**: Server-side EJS templates
- **Styling**: Responsive CSS (mobile-first for public, desktop for admin)
- **JavaScript**: Plain JavaScript (ES6+)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **Process Manager**: systemd (for non-Docker deployments)

## Prerequisites

### For Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+

### For Non-Docker Deployment
- Node.js 20+
- MySQL 8.0 or MariaDB 10.11+
- Nginx (optional, for reverse proxy)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/facility-reservation-system.git
cd facility-reservation-system
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=facility_user
DB_PASSWORD=your_secure_password
DB_NAME=facility_reservation

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your_smtp_password

# Payment Provider
PAYMENT_PROVIDER=stripe
PAYMENT_API_KEY=sk_live_your_key

# Application URL
APP_URL=https://your-domain.com
```

### 3A. Docker Deployment (Recommended)

#### Start All Services

```bash
docker-compose up -d
```

This will start:
- Application server (Node.js)
- Database (MariaDB)
- Reverse proxy (Nginx)

#### Run Database Migrations

```bash
docker-compose exec app npm run migrate
```

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db
docker-compose logs -f nginx
```

#### Stop Services

```bash
docker-compose down
```

#### Access the Application

- HTTP: http://localhost
- HTTPS: https://localhost (after SSL configuration)
- API Health Check: http://localhost/health

### 3B. Non-Docker Deployment

#### Install Dependencies

```bash
npm install
```

#### Set Up MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE facility_reservation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'facility_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON facility_reservation.* TO 'facility_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Run Database Migrations

```bash
npm run build
npm run migrate
```

#### Start the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm start
```

#### systemd Service Setup (Production)

1. Build the application:
```bash
npm run build
```

2. Copy files to deployment directory:
```bash
sudo mkdir -p /var/www/facility-reservation
sudo cp -r dist node_modules migrations public uploads package.json /var/www/facility-reservation/
sudo cp .env /var/www/facility-reservation/.env
```

3. Create application user:
```bash
sudo useradd -r -s /bin/false appuser
sudo chown -R appuser:appuser /var/www/facility-reservation
```

4. Install systemd service:
```bash
sudo cp facility-reservation.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable facility-reservation
sudo systemctl start facility-reservation
```

5. Check status:
```bash
sudo systemctl status facility-reservation
sudo journalctl -u facility-reservation -f
```

### 4. Nginx Configuration (Non-Docker)

For non-Docker deployments, configure Nginx as a reverse proxy:

```bash
sudo cp nginx/conf.d/default.conf /etc/nginx/sites-available/facility-reservation
sudo ln -s /etc/nginx/sites-available/facility-reservation /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Default Admin Account

After running migrations, a default admin account is created:

- **Email**: admin@example.com
- **Password**: admin123

**⚠️ IMPORTANT**: Change this password immediately after first login!

## API Documentation

### Public Endpoints

#### Rooms
- `GET /api/rooms` - List all active rooms
- `GET /api/rooms/:id` - Get room details
- `GET /api/rooms/:id/availability?year=2025&month=12` - Check availability

#### Equipment
- `GET /api/equipment` - List all equipment (grouped by category)

#### Applications (Reservations)
- `POST /api/applications` - Create new reservation
- `GET /api/applications/:id` - Get reservation details
- `GET /api/my-applications` - Get user's reservations (authenticated)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/request-password-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Admin Endpoints (Require Admin Authentication)

#### Application Management
- `GET /api/admin/applications` - List all applications (with filters)
- `GET /api/admin/applications/:id` - Get application details
- `PATCH /api/admin/applications/:id` - Update application
- `POST /api/admin/applications/:id/cancel` - Cancel application

#### Room Management
- `GET /api/admin/rooms` - List all rooms
- `POST /api/admin/rooms` - Create room
- `PATCH /api/admin/rooms/:id` - Update room
- `DELETE /api/admin/rooms/:id` - Delete room (soft delete)

#### Equipment Management
- `GET /api/admin/equipment` - List all equipment
- `POST /api/admin/equipment` - Create equipment
- `PATCH /api/admin/equipment/:id` - Update equipment
- `DELETE /api/admin/equipment/:id` - Delete equipment (soft delete)

#### Usage Management
- `PATCH /api/admin/usages/:id/ac-hours` - Update AC hours

## Testing

Run unit tests for pricing logic:

```bash
npm test
```

## Pricing Logic

The system implements complex pricing rules:

### Time Slots
- **Morning**: 09:00-12:00
- **Afternoon**: 13:00-17:00
- **Evening**: 18:00-21:30

### Extension Blocks
- **Midday Extension**: 12:00-13:00 (FREE if Morning + Afternoon, otherwise charged)
- **Evening Extension**: 17:00-18:00 (FREE if Afternoon + Evening, otherwise charged)

### Entrance Fee Multiplier
Applies ONLY to room charges:
- Free or ¥0: 1.0x
- ¥1-¥3,000: 1.5x
- ¥3,001+: 2.0x

### Equipment Pricing
- **per_slot**: `unit_price × quantity × slot_count`
- **flat**: `unit_price` (one-time fee)
- **free**: ¥0

### Air Conditioning
- Charged based on actual hours used (staff-entered)
- Formula: `ac_hours × ac_price_per_hour`

### Cancellation Fees
- Cancelled BEFORE usage date: 0%
- Cancelled ON or AFTER usage date: 100%

## SSL/TLS Configuration

### Let's Encrypt (Recommended for Production)

1. Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. Obtain certificate:
```bash
sudo certbot --nginx -d your-domain.com
```

3. Update `nginx/conf.d/default.conf` with SSL configuration

4. Auto-renewal:
```bash
sudo certbot renew --dry-run
```

## Backup & Maintenance

### Database Backup

```bash
# Docker
docker-compose exec db mysqldump -u facility_user -p facility_reservation > backup.sql

# Non-Docker
mysqldump -u facility_user -p facility_reservation > backup.sql
```

### Database Restore

```bash
# Docker
docker-compose exec -T db mysql -u facility_user -p facility_reservation < backup.sql

# Non-Docker
mysql -u facility_user -p facility_reservation < backup.sql
```

## Troubleshooting

### Database Connection Issues

```bash
# Check database is running
docker-compose ps db

# Check connection from app container
docker-compose exec app npm run migrate
```

### Port Conflicts

If port 80 or 3306 is already in use, modify `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "8080:80"  # Use port 8080 instead

db:
  ports:
    - "3307:3306"  # Use port 3307 instead
```

### Email Not Sending

In development, check console logs for email content:

```bash
docker-compose logs -f app | grep "\[DEV\]"
```

## Security Recommendations

1. **Change default admin password** immediately
2. **Use strong JWT secret** (minimum 32 characters)
3. **Enable HTTPS** in production
4. **Configure firewall** to restrict database access
5. **Set up regular backups**
6. **Keep dependencies updated**: `npm audit` and `npm update`
7. **Use environment variables** for all secrets
8. **Enable rate limiting** (already configured)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

ISC

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/facility-reservation-system/issues
- Email: support@example.com

---

**Built with ❤️ for public facility management**
