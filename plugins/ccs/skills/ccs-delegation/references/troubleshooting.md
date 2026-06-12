# Troubleshooting

AI-oriented error resolution guide for CCS delegation issues.

**Structure**: Quick Reference -> Error Catalog -> Common Resolutions -> Diagnostics -> Recovery

**Cross-references**:

- Technical details: `headless-workflow.md`
- Decision framework: `delegation-guidelines.md`

## Quick Reference

**Profile/Config Issues:**

- E-001: "Profile 'X' not configured" -> `ccs doctor`
- E-002: "Invalid API key" (401) -> Check `~/.ccs/{profile}.settings.json`
- E-003: "Settings file not found" -> `ccs doctor` to configure
- E-004: JSON parse error (settings) -> Validate with `jq . ~/.ccs/{profile}.settings.json`

**Delegation Issues:**

- D-001: "No previous session" -> Run `ccs {profile} -p "task"` first
- D-002: "Missing prompt" -> Syntax: `ccs {profile} -p "prompt"`
- D-003: "No profile specified" -> Syntax: `ccs <profile> -p "task"`
- D-005: File not found -> Verify CWD (delegation runs in current directory)

**Session Issues:**

- S-001: Session corrupted -> `rm ~/.ccs/delegation-sessions.json`
- S-002: Session expired -> Start new: `ccs {profile} -p "task"`

**Network Issues:**

- N-001: Connection timeout -> Check internet/endpoint -> Retry
- N-002: Rate limit (429) -> Wait 60s -> Retry

**CLI Issues:**

- C-001: Claude CLI not found -> Install from code.claude.com
- C-002: Outdated version -> Update: `ccs sync` or `ccs update`

## Error Catalog

### Environment/Config Errors

| Code  | Pattern                     | Root Cause            | Resolution                                            |
| ----- | --------------------------- | --------------------- | ----------------------------------------------------- |
| E-001 | Profile 'X' not configured  | Missing settings file | `ccs doctor` -> configure manually                    |
| E-002 | Invalid API key (401)       | Token expired/invalid | Verify token in settings.json -> regenerate if needed |
| E-003 | Settings file not found     | File doesn't exist    | `ccs doctor` -> shows missing profiles                |
| E-004 | JSON parse error (settings) | Malformed JSON        | Validate: `jq . ~/.ccs/{profile}.settings.json`       |

### Delegation Execution Errors

| Code  | Pattern                 | Root Cause                   | Resolution                                   |
| ----- | ----------------------- | ---------------------------- | -------------------------------------------- |
| D-001 | No previous session     | Using :continue without init | Run `ccs {profile} -p "init"` first          |
| D-002 | Missing prompt after -p | No argument provided         | Quote prompt: `ccs {profile} -p "text"`      |
| D-003 | No profile specified    | Missing profile name         | Syntax: `ccs <profile> -p "task"`            |
| D-004 | Invalid profile name    | Profile doesn't exist        | Check: `ccs doctor` for available profiles   |
| D-005 | File not found          | CWD mismatch                 | Verify: delegation runs in current directory |

### Session Management Errors

| Code  | Pattern                | Root Cause          | Resolution                                               |
| ----- | ---------------------- | ------------------- | -------------------------------------------------------- |
| S-001 | Session file corrupted | Malformed JSON      | `rm ~/.ccs/delegation-sessions.json` -> fresh start      |
| S-002 | Session expired        | >30 days old        | Start new: `ccs {profile} -p "task"`                     |
| S-003 | Session ID mismatch    | ID not found        | Check: `jq '.{profile}' ~/.ccs/delegation-sessions.json` |
| S-004 | Cost aggregation error | Calculation failure | Reset session or ignore (doesn't affect execution)       |

### Network/API Errors

| Code  | Pattern                  | Root Cause              | Resolution                                   |
| ----- | ------------------------ | ----------------------- | -------------------------------------------- |
| N-001 | Connection timeout       | Network/API unreachable | Check: internet, endpoint, firewall -> Retry |
| N-002 | Rate limiting (429)      | Too many requests       | Wait 60s -> Retry                            |
| N-003 | API endpoint unreachable | Wrong URL in settings   | Verify ANTHROPIC_BASE_URL in settings.json   |
| N-004 | SSL/TLS error            | Certificate issue       | Check system certs, firewall SSL inspection  |

### Claude CLI Compatibility Errors

| Code  | Pattern                     | Root Cause         | Resolution                            |
| ----- | --------------------------- | ------------------ | ------------------------------------- |
| C-001 | Claude CLI not found        | Not installed      | Install from code.claude.com          |
| C-002 | Outdated CLI version        | Old version        | Update: `ccs sync` or `ccs update`    |
| C-003 | stream-json not supported   | Version < required | Upgrade CLI: check `claude --version` |
| C-004 | Permission mode unsupported | Old CLI version    | Upgrade to support --permission-mode  |

### Timeout/Resource Errors

| Code  | Pattern                    | Root Cause            | Resolution                                |
| ----- | -------------------------- | --------------------- | ----------------------------------------- |
| T-001 | Execution timeout (10 min) | Task too complex/slow | Simplify task or split into smaller tasks |
| T-002 | Memory limit exceeded      | Large file processing | Reduce scope, process in batches          |
| T-003 | Process killed (SIGTERM)   | External termination  | Check system resources, retry             |

## Common Resolution Patterns

**Profile Validation:**

```bash
ccs doctor                          # Check all profiles
cat ~/.ccs/{profile}.settings.json  # Verify settings
ccs {profile} "test" 2>&1           # Test execution
```

**Session Management:**

```bash
jq . ~/.ccs/delegation-sessions.json              # View all sessions
jq '.{profile}' ~/.ccs/delegation-sessions.json   # Check specific profile
rm ~/.ccs/delegation-sessions.json                # Reset (loses all sessions)
```

**Debug Mode:**

```bash
export CCS_DEBUG=1
ccs {profile} -p "task" 2>&1 | tee debug.log  # Capture full output
```

## Diagnostic Toolkit

**Profile diagnostics:**

```bash
ccs doctor        # All profiles status
ccs --version     # CCS version + delegation status
claude --version  # CLI version (check stream-json support)
```

**Test delegation flow:**

```bash
# Simple task
ccs glm -p "create test.txt with 'hello'"

# Verify session
jq '.glm.sessionId' ~/.ccs/delegation-sessions.json

# Continue
ccs glm:continue -p "append 'world' to test.txt"

# Check aggregation
jq '.glm.turns' ~/.ccs/delegation-sessions.json
```

## Emergency Recovery

**Reset session state:**

```bash
rm ~/.ccs/delegation-sessions.json  # Fresh start (loses all sessions)
```

**Interactive mode (no -p flag):**

```bash
ccs {profile}  # Opens interactive session
```
