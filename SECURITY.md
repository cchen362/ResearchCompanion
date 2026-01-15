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

**User Data Protection:**
- All medical research data stored locally in IndexedDB
- No automatic cloud synchronization
- User controls all data export/import
- Backend stores only authentication data
- No personal health information in server logs

### Authentication

**JWT Security:**
- Use strong, randomly generated JWT secrets
- Implement token expiration (default: 7 days)
- Secure token storage in httpOnly cookies (when possible)
- Regular token rotation

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