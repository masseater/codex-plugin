---
description: Observability policy — logging, metrics, tracing, error tracking, and AI agent access
---

# Observability Policy

Inherits from Standards Philosophy. This document defines **goals and preferred standards** (OpenTelemetry), not step-by-step configuration guides.

## Three Pillars

All production services must emit **logs**, **metrics**, and **traces**. Omitting any pillar creates blind spots that make debugging reactive instead of proactive.

## Logging

### Instrumentation Layer

| Layer                   | What to capture                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| HTTP requests/responses | Method, path, status, duration, request ID                                               |
| Database queries        | Query type, table, duration, row count                                                   |
| External API calls      | Endpoint, status, duration, retry count                                                  |
| Business logic          | State transitions, decision branch outcomes — only when the layers above cannot cover it |

### Log Level Policy

| Level | When to use                                                                 |
| ----- | --------------------------------------------------------------------------- |
| fatal | Process cannot continue — crash imminent                                    |
| error | Operation failed — requires attention but process survives                  |
| warn  | Unexpected condition that was handled — may indicate a deeper issue         |
| info  | Significant business events — request completed, job processed, user action |
| debug | Diagnostic detail — off in production by default                            |
| trace | Extremely verbose — only enabled for targeted debugging                     |

### Rules

- All logs must be structured JSON — never unstructured string concatenation
- Follow OpenTelemetry Logs data model as the schema standard
- Production logs go to stdout — the execution environment handles routing (12-factor, Factor XI)
- Local development additionally writes to files so logs survive terminal scrollback
- Never log secrets, tokens, passwords, or PII — configure redaction at the logger level
- Every request must carry a request ID — generate at the middleware layer and propagate through all downstream calls

## Metrics

| Instrument | When to use                                     |
| ---------- | ----------------------------------------------- |
| Counter    | Request counts, error counts, events            |
| Histogram  | Latency distributions, response sizes           |
| Gauge      | Queue depth, active connections, resource usage |

- Expose request rate, error rate, and latency percentiles (RED method) for every service
- Track custom business metrics where they directly inform operational decisions
- Use OpenTelemetry Metrics API as the instrumentation standard — export to the platform's native metrics backend

## Tracing

- All cross-service calls must propagate trace context (W3C Trace Context / `traceparent` header)
- Use OpenTelemetry Tracing SDK — auto-instrument HTTP, DB, and messaging layers before adding manual spans
- Every trace must include the request ID from the logging layer for cross-correlation

## Error Tracking

- All unhandled exceptions and explicit error reports must flow to a dedicated error tracking service
- Errors must be grouped, deduplicated, and trigger alerts — raw log search is not a substitute
- Source maps must be uploaded so stack traces point to original source

## Log Access

### Deploy Logs

- Configure log drains to the platform's native log viewer before launch, not after an incident
- Logs must be searchable by structured JSON fields — time range, severity, request ID, trace ID, user ID

### AI Agent Access

- Provide CLI commands or MCP tools that let AI agents query recent logs
- AI agents must be able to filter by time range, severity, request ID, and trace ID without manual intervention
- Scope AI access appropriately — production logs may contain sensitive data even after redaction
