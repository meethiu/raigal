---
description: "Admin API endpoints, organization provisioning, API key rotation, and license lease issuance."
icon: key
---

# Admin API & Licensing

Raigal Cloud provides an administrative REST API for provisioning accounts, managing enterprise seats, and rotating tokens.

## Authentication Headers

Admin requests must present a valid Clerk session token belonging to an authorized platform administrator:

```http
Authorization: Bearer <clerk_session_token>
```

## Endpoints Overview

### `GET /api/admin/organizations`
Returns a paginated list of all active enterprise organizations, their current plan tiers, and active seat counts.

### `POST /api/admin/organizations`
Provisions a new organization.

**Request Body:**
```json
{
  "name": "Cyberdyne Systems",
  "slug": "cyberdyne",
  "tier": "enterprise",
  "seats": 100
}
```

### `POST /api/admin/organizations/:orgId/keys`
Generates a new organization API key (`rgl_live_...`).

{% hint style="warning" %}
The raw API key is returned **only once** in the response. Raigal Cloud stores only the SHA-256 hash in PostgreSQL.
{% endhint %}

### `POST /v1/entitlement`
The core entitlement exchange endpoint called by the CLI during `raigal login` or CI scan startup.
- Verifies organization membership or valid API key.
- Generates an Ed25519-signed JWT containing:
  - `sub`: Organization ID
  - `tier`: Subscription tier
  - `exp`: Timestamp (72-hour lease validity)
  - `features`: Array of authorized engines
