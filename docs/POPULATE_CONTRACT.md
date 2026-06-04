# API Populate Contract — Frontend ↔ Backend Reference

## The Problem

MongoDB IDs and Mongoose's `.populate()` are **the single biggest source of silent bugs** in this codebase. The rule is:

> A populated ref field is always a **plain object** `{ _id, ...otherFields }`.
> An unpopulated ref field is always a **raw id** (string or ObjectId instance).
> **The field name is the same in both cases** — only the *shape* differs.

Comparing a populated object against a raw id with `===` silently returns `false`.
There is no warning, no error, no console message. The filter just returns an
empty list, and the UI shows an empty state.

## The Solution

**Always normalize a ref before comparing it.** Use `refId()` from
`frontend/src/lib/api.js`:

```js
import { refId } from '../../lib/api';

// ✅ Correct
notifications.filter(n => refId(n.job) === jobId)
notifications.filter(n => refId(n.application) === app._id)

// ❌ Bug — silently drops every populated notification
notifications.filter(n => n.job === jobId)
notifications.filter(n => n.application === app._id)
```

`refId()` returns a string either way, so direct `===` is safe.

## Which Fields Are Populated, Per Endpoint

This is the **authoritative list**. If a backend route starts populating a new
field, update this table or you'll get the bug back.

### `GET /api/notifications`
File: `backend/routes/notifications.js` (line 29-30)
| Field | Populated? | Populated shape |
|---|---|---|
| `user` | NO | raw id |
| `officer` | NO | raw id |
| `job` | **YES** | `{ _id, title, companyName }` |
| `application` | **YES** | `{ _id, status }` |

### `GET /api/applications/my`
File: `backend/routes/applications.js` (line 48)
| Field | Populated? | Populated shape |
|---|---|---|
| `student` | NO | raw id |
| `job` | **YES (full)** | full Job document |

### `GET /api/officer/job-applicants/:jobId`
File: `backend/routes/officer.js` (line 62)
| Field on Application | Populated? | Populated shape |
|---|---|---|
| `student` | **YES (huge)** | full student profile (name, email, phone, all 18 fields) |
| `job` | NO (we filter by jobId) | n/a |

### `GET /api/officer/applicants/:applicantId`
File: `backend/routes/officer.js` (line 121)
| Field | Populated? | Populated shape |
|---|---|---|
| `student` | **YES** | `{ name, email, studentProfile }` |
| `job` | **YES** | `{ title, companyName }` |

### `GET /api/admin/jobs`
File: `backend/routes/admin.js` (line 91)
| Field | Populated? | Populated shape |
|---|---|---|
| `postedBy` | **YES** | `{ name, email }` |

### `GET /api/admin/applications`
File: `backend/routes/admin.js` (line 114)
| Field | Populated? | Populated shape |
|---|---|---|
| `student` | **YES** | `{ name, email, studentProfile }` |
| `job` | **YES** | `{ title, companyName }` |

### `GET /api/jobs/:id` (saved jobs user info)
File: `backend/routes/jobs.js` (line 70)
| Field on User | Populated? | Populated shape |
|---|---|---|
| `savedJobs` | **YES (full)** | full Job documents |

## Quick Decision Rule

When you find yourself writing any of these in frontend code, **stop** and ask:
*"Is this field populated in the backend response?"* Then check this table or the
backend route file. If yes, wrap with `refId()`.

- `someObj.field === someId`
- `someArr.find(x => x.field === someId)`
- `someArr.some(x => x.field === someId)`
- `someArr.filter(x => x.field === someId)`
- `ids.includes(someObj.field)`

## Update Protocol

When you add or change a `.populate()` call in the backend:
1. Update the table above for that endpoint.
2. Grep the frontend for direct `===` comparisons against the field name.
3. Wrap any matches with `refId()`.

This file is the single source of truth — keep it in sync with the code.
