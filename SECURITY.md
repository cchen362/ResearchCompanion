# Security Policy

## Reporting Security Vulnerabilities

We take security seriously in the Medical Companion PWA. If you discover a security vulnerability, please follow these steps:

### Do NOT:
- Create a public GitHub issue for security vulnerabilities
- Share the vulnerability publicly before it's fixed
- Exploit the vulnerability beyond necessary verification

### DO:
1. **Report privately** through one of these channels:
   - Create a private security advisory in GitHub (preferred)
   - Email the maintainers directly with details

2. **Include in your report:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

3. **Response timeline:**
   - Acknowledgment: Within 48 hours
   - Status update: Within 1 week
   - Fix timeline: Depends on severity

## Security Considerations

### API Keys

**Critical Security Requirements:**
- NEVER commit API keys to version control
- Use environment variables for all sensitive configuration
- Rotate API keys regularly
- Use separate keys for development and production
- Set spending limits on all API services

### Data Privacy

**User Data Protection (v2.0 with PostgreSQL):**
- Medical research data stored in PostgreSQL with user isolation
- Local IndexedDB cache for offline access
- Row-level security in PostgreSQL for multi-tenant isolation
- Encrypted passwords with bcrypt (10 salt rounds)
- User controls all data export/import
- No personal health information in application logs
- Automatic session expiry after 30 days
- SSL/TLS encryption for production database connections

### Authentication

**JWT Security:**
- Use strong, randomly generated JWT secrets (minimum 64 characters)
- Session expiration: 30 days (configurable)
- Refresh token support for seamless re-authentication
- Multi-device session management in PostgreSQL
- Secure token storage in httpOnly cookies (when possible)
- Regular token rotation

### Database Security (PostgreSQL)

**PostgreSQL Security Measures:**
- **Connection Security:**
  - Use SSL/TLS for production connections
  - Connection pooling with pg library (max 20 connections default)
  - Parameterized queries to prevent SQL injection
  - Database credentials in environment variables only

- **Access Control:**
  - Row-level security for multi-tenant data isolation
  - Each user can only access their own data
  - Prepared statements for all queries
  - No direct database access from frontend

- **Data Protection:**
  - Passwords hashed with bcrypt (10 salt rounds)
  - JSONB fields for flexible, validated metadata
  - Automatic timestamps for audit trails
  - Regular automated backups (configurable schedule)

### Dependencies

**Keeping Dependencies Secure:**
- Regularly run `npm audit` to check for vulnerabilities
- Keep all dependencies updated
- Review dependency licenses
- Minimize dependency footprint

## Security Best Practices for Deployment

### 1. HTTPS Configuration
```nginx
# Always redirect HTTP to HTTPS
server {
    listen 80;
    return 301 https://$server_name$request_uri;
}
```

### 2. Content Security Policy
```javascript
// Recommended CSP headers
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
}
```

### 3. Environment Variables
```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET

# Set restrictive permissions
chmod 600 .env
```

### 4. Rate Limiting
Implement rate limiting for:
- API endpoints
- Authentication attempts
- Agent execution requests

### 5. Input Validation
- Validate all user inputs
- Use Zod schemas for runtime validation
- Sanitize data before storage
- Escape output in UI rendering

## Known Security Considerations

### Current Limitations:
1. **Local Storage Security**: IndexedDB data is not encrypted by default
2. **Service Worker**: Requires HTTPS in production
3. **API Key Exposure**: Frontend never directly handles API keys

### Recommended Mitigations:
1. Use device-level encryption
2. Always deploy with HTTPS
3. Use backend proxy for all AI services

## Security Checklist for Contributors

Before submitting code:
- [ ] No hardcoded credentials
- [ ] No sensitive data in console.logs
- [ ] Input validation implemented
- [ ] Error messages don't expose system details
- [ ] Dependencies are up to date
- [ ] Security headers configured
- [ ] HTTPS enforced in production
- [ ] Rate limiting considered

## Vulnerability Disclosure Policy

We follow responsible disclosure:
1. Reporter notifies us privately
2. We acknowledge and investigate
3. We develop and test a fix
4. We release the fix
5. We publicly disclose after users have time to update

## Security Updates

Security updates will be:
- Released as soon as possible
- Documented in release notes
- Announced through GitHub security advisories

## Contact

For security concerns, contact the maintainers through:
- GitHub Security Advisories (preferred)
- Project maintainer emails

## Compliance Note

This software is for research purposes. Users are responsible for:
- HIPAA compliance (if applicable)
- GDPR compliance (if applicable)
- Local healthcare data regulations
- Ethical use of medical information

---

Thank you for helping keep Medical Companion PWA secure! 🔐