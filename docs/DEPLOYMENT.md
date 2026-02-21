# Deployment & Testing Guide

This document covers environment setup, local testing, production deployment, and rollout procedures for the DropCharge application.

## Table of Contents
1. [Environment Variables](#environment-variables)
2. [Local Development & Testing](#local-development--testing)
3. [Production Deployment](#production-deployment)
4. [Production Testing](#production-testing)
5. [Rollout Procedures](#rollout-procedures)
6. [Health Monitoring](#health-monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Environment Variables

### Required Variables

These environment variables **must** be set in Netlify for the application to function properly:

#### Supabase Configuration
- **`SUPABASE_URL`**: Your Supabase project URL
  - Format: `https://your-project.supabase.co`
  - Get from: Supabase Project Settings → API → Project URL
  
- **`SUPABASE_SERVICE_KEY`**: Service role key for Supabase
  - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Get from: Supabase Project Settings → API → service_role key
  - ⚠️ **IMPORTANT**: This is a sensitive key with full database access. Keep it secure!

#### Admin Authentication
- **`ADMIN_PASSWORD_HASH`**: Bcrypt hash of the admin password
  - Generate with: `node scripts/hash-password.js "your-strong-password"`
  - Example output: `$2a$12$abcdef...`

### Optional Variables

- **`ADMIN_ALLOWED_ORIGINS`**: Comma-separated list of allowed CORS origins
  - Default: `https://dropchargeadmin.netlify.app,https://dropcharge.netlify.app,http://localhost:8888`
  - Customize if you have additional domains

- **`ADMIN_HASH_ROUNDS`**: Number of bcrypt rounds for password hashing
  - Default: `12`
  - Higher = more secure but slower

- **`ENABLE_DOUBLE_OPT_IN`**: Enable double opt-in for newsletter signups
  - Set to `1` to enable
  - Requires email service configuration

- **`TIKTOK_PIXEL_ID`**: TikTok Pixel ID for tracking
  - Format: `TT-XXXX`
  - Optional for analytics

- **`NODE_ENV`**: Environment identifier
  - Values: `production`, `development`
  - Default: `production`

### Setting Environment Variables in Netlify

1. Go to your site in Netlify Dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add a variable**
4. Enter the variable name and value
5. Click **Save**
6. Deploy your site for changes to take effect

---

## Local Development & Testing

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Netlify CLI (`npm install -g netlify-cli`)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/florianlux/dropcharge.git
   cd dropcharge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create local environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` with your Supabase credentials and other settings:
   ```bash
   # Example .env file
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   ADMIN_PASSWORD_HASH=$(node scripts/hash-password.js "your-password")
   ```

5. **Start local development server**
   ```bash
   npx netlify dev
   ```
   
   The site will be available at `http://localhost:8888`

### Testing Locally

#### Test the Main Site
```bash
# Open in browser
open http://localhost:8888
```

#### Test Affiliate Redirect
```bash
# Test a redirect (should return 302 and log click)
curl -i http://localhost:8888/go/psn-20
```

#### Test Health Endpoint
```bash
# Check system health
curl http://localhost:8888/admin/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "timestamp": "2026-02-21T01:00:00.000Z",
    "environment": "development",
    "supabase": {
      "configured": true,
      "urlPresent": true,
      "serviceKeyPresent": true,
      "connected": true,
      "error": null
    },
    "netlify": {
      "functionName": "health",
      "region": "us-east-1"
    }
  }
}
```

#### Test Activity API
```bash
# Get activity for a specific slug
curl "http://localhost:8888/api/activity?slug=psn-20" | jq
```

#### Test Admin Login
```bash
# Login to admin (replace with your password)
curl -X POST http://localhost:8888/.netlify/functions/admin-login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}' \
  -c cookies.txt -v
```

#### Review Logs
When running `netlify dev`, all function logs appear in the terminal with structured JSON:
```json
{
  "requestId": "abc123def456",
  "function": "go",
  "method": "GET",
  "path": "/go/psn-20",
  "timestamp": "2026-02-21T01:00:00.000Z",
  "level": "info",
  "message": "Request started",
  "userAgent": "curl/7.79.1",
  "clientIp": "127.0.0.1"
}
```

---

## Production Deployment

### Initial Deployment

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Deploy updates"
   git push origin main
   ```

2. **Set environment variables in Netlify**
   - Follow steps in [Setting Environment Variables in Netlify](#setting-environment-variables-in-netlify)
   - Ensure all required variables are set before deploying

3. **Deploy via Netlify Dashboard**
   - Netlify will automatically deploy when you push to the main branch
   - Or manually trigger: **Deploys** → **Trigger deploy** → **Deploy site**

### Deploy via CLI

```bash
# Login to Netlify
netlify login

# Link to your site (first time only)
netlify link

# Deploy to production
netlify deploy --prod
```

### Verify Deployment

After deployment completes:

1. Check the deploy log for errors
2. Visit your production URL
3. Test the health endpoint (see [Production Testing](#production-testing))

---

## Production Testing

### Test Health Endpoint

```bash
# Replace with your production domain
curl https://dropcharge.netlify.app/admin/health | jq
```

Expected: `"status": "healthy"` with all checks passing.

### Test Affiliate Redirect

```bash
# Test a redirect (should return 302)
curl -I https://dropcharge.netlify.app/go/psn-20
```

Expected: HTTP 302 with `Location` header pointing to affiliate URL.

### Test Activity API

```bash
# Get activity data
curl "https://dropcharge.netlify.app/api/activity?slug=psn-20" | jq
```

Expected: JSON with `slug`, `lastClickTs`, and `clicks30m`.

### Test Admin Login

```bash
# Test admin login
curl -X POST https://dropcharge.netlify.app/.netlify/functions/admin-login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-production-password"}' \
  -v
```

Expected: HTTP 200 with session cookie set.

### Test CORS Headers

```bash
# Check CORS headers
curl -H "Origin: https://dropcharge.netlify.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  -X OPTIONS \
  https://dropcharge.netlify.app/api/activity -v
```

Expected: CORS headers in response.

### Check Logs in Netlify

1. Go to Netlify Dashboard → Your Site → **Functions**
2. Click on any function (e.g., `go`, `health`)
3. View recent invocations and logs
4. Look for structured JSON logs with `requestId`, `level`, `message`, etc.

---

## Rollout Procedures

### Standard Rollout

1. **Test in local environment**
   - Run `netlify dev`
   - Test all changed functionality
   - Review console logs for errors

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   git add .
   git commit -m "Add feature: description"
   git push origin feature/your-feature-name
   ```

3. **Deploy to preview**
   - Netlify automatically creates a deploy preview for pull requests
   - Test the preview URL thoroughly

4. **Merge to main**
   - After testing passes, merge the PR
   - Netlify auto-deploys to production

5. **Verify production**
   - Run production tests (see [Production Testing](#production-testing))
   - Check health endpoint
   - Monitor Netlify function logs

### Rollback Procedure

If issues are detected in production:

1. **In Netlify Dashboard**
   - Go to **Deploys**
   - Find the last known good deploy
   - Click **Publish deploy** to restore it

2. **Via Git**
   ```bash
   # Revert the problematic commit
   git revert <commit-hash>
   git push origin main
   ```

### Emergency Hotfix

For critical production issues:

1. **Create hotfix branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue
   ```

2. **Make minimal fix**
   ```bash
   # Make changes
   git add .
   git commit -m "Hotfix: description"
   git push origin hotfix/critical-issue
   ```

3. **Test in preview deploy**
   - Verify the fix works

4. **Merge directly to main**
   ```bash
   git checkout main
   git merge hotfix/critical-issue
   git push origin main
   ```

5. **Monitor deployment**
   - Watch Netlify deploy logs
   - Test production immediately after deploy

---

## Health Monitoring

### Health Check Endpoint

URL: `/admin/health`

**Purpose**: Verify system health and connectivity

**Response Structure**:
```json
{
  "status": "healthy" | "unhealthy",
  "checks": {
    "timestamp": "ISO 8601 timestamp",
    "environment": "production",
    "supabase": {
      "configured": true,
      "urlPresent": true,
      "serviceKeyPresent": true,
      "connected": true,
      "error": null
    },
    "netlify": {
      "functionName": "health",
      "region": "us-east-1"
    }
  }
}
```

**Status Codes**:
- `200`: System is healthy
- `503`: System is unhealthy (Supabase connection failed)

### Monitoring Strategy

#### Manual Monitoring
```bash
# Check health every few minutes
while true; do
  echo "$(date): Checking health..."
  curl -s https://dropcharge.netlify.app/admin/health | jq -r '.status'
  sleep 300  # Check every 5 minutes
done
```

#### Automated Monitoring (Recommended)

Set up external monitoring with services like:
- **UptimeRobot**: Free tier monitors every 5 minutes
- **Pingdom**: More advanced monitoring
- **StatusCake**: Free tier available

**Configuration**:
- Monitor URL: `https://dropcharge.netlify.app/admin/health`
- Check interval: 5 minutes
- Alert on: Status code != 200 or response contains `"status": "unhealthy"`

### Structured Logging

All Netlify functions now include structured JSON logging:

**Log Format**:
```json
{
  "requestId": "unique-request-id",
  "function": "function-name",
  "method": "GET|POST|PUT|DELETE",
  "path": "/request/path",
  "timestamp": "ISO 8601 timestamp",
  "level": "info|warn|error",
  "message": "Log message",
  "statusCode": 200,
  "durationMs": 123,
  "error": {
    "message": "Error message",
    "name": "ErrorName",
    "stack": "Stack trace...",
    "code": "ERROR_CODE"
  }
}
```

**Benefits**:
- Easy to parse and analyze
- Searchable by `requestId` across multiple log entries
- Includes timing information
- Full error stack traces

---

## Troubleshooting

### Common Issues

#### 1. "Supabase missing env: SUPABASE_URL"

**Cause**: `SUPABASE_URL` environment variable not set

**Solution**:
- Set `SUPABASE_URL` in Netlify environment variables
- Redeploy the site

#### 2. "Supabase missing env: SUPABASE_SERVICE_KEY"

**Cause**: `SUPABASE_SERVICE_KEY` environment variable not set

**Solution**:
- Set `SUPABASE_SERVICE_KEY` in Netlify environment variables
- Redeploy the site

#### 3. Health check returns "unhealthy"

**Cause**: Cannot connect to Supabase

**Solution**:
1. Verify Supabase project is active
2. Check `SUPABASE_URL` is correct
3. Check `SUPABASE_SERVICE_KEY` is valid
4. Check Supabase project has required tables (`clicks`, `emails`, `events`, etc.)

#### 4. CORS errors in admin dashboard

**Cause**: Origin not in allowed list

**Solution**:
- Add your domain to `ADMIN_ALLOWED_ORIGINS` environment variable
- Format: `https://domain1.com,https://domain2.com`
- Redeploy

#### 5. Functions timing out

**Cause**: Slow Supabase queries or external API calls

**Solution**:
1. Check Netlify function logs for slow queries
2. Add database indexes if needed
3. Implement caching where appropriate
4. Consider increasing function timeout (Netlify settings)

#### 6. Local development: "Cannot connect to Supabase"

**Cause**: `.env` file not configured

**Solution**:
1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials
3. Restart `netlify dev`

### Getting Help

If you encounter issues not covered here:

1. **Check Netlify Function Logs**: Dashboard → Functions → Select function → View logs
2. **Check Supabase Logs**: Supabase Dashboard → Logs
3. **Search logs for `requestId`**: Use the requestId from error responses to trace the full request lifecycle
4. **Review recent deployments**: Check if issue started after a specific deploy

---

## Checklist: Pre-Deployment

Before deploying to production, verify:

- [ ] All required environment variables are set in Netlify
- [ ] `SUPABASE_URL` is correct
- [ ] `SUPABASE_SERVICE_KEY` is the service role key (not anon key)
- [ ] `ADMIN_PASSWORD_HASH` is set (generated with `hash-password.js`)
- [ ] Local testing completed (`netlify dev`)
- [ ] Health endpoint tested (`/admin/health` returns healthy)
- [ ] Affiliate redirects tested (`/go/*` returns 302)
- [ ] Admin login tested
- [ ] All functions log to console with structured JSON
- [ ] `.env` file is in `.gitignore` (never committed)
- [ ] Documentation updated if needed

## Checklist: Post-Deployment

After deploying to production, verify:

- [ ] Health endpoint returns healthy status
- [ ] Affiliate redirects work
- [ ] Activity API returns data
- [ ] Admin dashboard loads and displays data
- [ ] No errors in Netlify function logs
- [ ] Supabase connection is working
- [ ] All CORS headers are present
- [ ] Security headers are present (check with browser dev tools)

---

## Quick Reference

### Useful Commands

```bash
# Local development
netlify dev

# Deploy to production
netlify deploy --prod

# Generate password hash
node scripts/hash-password.js "your-password"

# Check health (local)
curl http://localhost:8888/admin/health | jq

# Check health (production)
curl https://dropcharge.netlify.app/admin/health | jq

# Test redirect (local)
curl -I http://localhost:8888/go/psn-20

# Test redirect (production)
curl -I https://dropcharge.netlify.app/go/psn-20

# View function logs (CLI)
netlify functions:log <function-name>
```

### Important URLs

- Production site: `https://dropcharge.netlify.app`
- Admin dashboard: `https://dropcharge.netlify.app/admin`
- Admin login: `https://dropcharge.netlify.app/admin/login`
- Health check: `https://dropcharge.netlify.app/admin/health`
- Netlify Dashboard: `https://app.netlify.com`
- Supabase Dashboard: `https://app.supabase.com`

---

## Summary

This guide covers:
✅ All required and optional environment variables
✅ Local development and testing procedures
✅ Production deployment steps
✅ Production testing with curl examples
✅ Rollout and rollback procedures
✅ Health monitoring with /admin/health endpoint
✅ Structured logging with request IDs
✅ Troubleshooting common issues

For questions or issues, refer to the troubleshooting section or check the function logs in Netlify.
