# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You should receive a response within 72 hours. We will work with you to understand and address the issue before any public disclosure.

## Scope

Astera is a local-first tool. It does not:
- Send data to external servers
- Accept network input beyond localhost HTTP requests
- Execute arbitrary code from untrusted sources

The primary attack surface is:
- Maliciously crafted source files (fuzzing target)
- Path traversal via file serving in the web UI
- SQLite injection via query parameters

## Security Measures

- All file serving uses sanitized paths
- SQL queries use parameterized statements (rusqlite)
- No `unsafe` code in the application
- GitHub Actions workflows follow injection-safe patterns
