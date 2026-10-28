# Data model

Each service owns its own database inside the same PostgreSQL instance. There are no foreign keys across databases: `business-api` stores the user identifier from the JWT (`sub`) as a plain UUID.

## auth_db (auth-api)

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email UK
        string full_name
        string password_hash
        enum role "root | admin | user"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
```

## business_db (business-api)

```mermaid
erDiagram
    CLIENTS ||--o{ ENGINES : owns
    CLIENTS ||--o{ REPAIR_ORDERS : requests
    ENGINES ||--o{ REPAIR_ORDERS : "is repaired in"
    REPAIR_ORDERS ||--o{ REPAIR_ORDER_STATUS_HISTORY : tracks

    CLIENTS {
        uuid id PK
        string name
        enum identification_type
        string identification_number
        string email
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    ENGINES {
        uuid id PK
        string serial_number UK
        string manufacturer
        string model
        string engine_type
        string power_rating
        uuid client_id FK
        timestamp registered_at
        boolean is_active
        timestamp updated_at
    }
    REPAIR_ORDERS {
        uuid id PK
        string order_number UK
        uuid engine_id FK
        uuid client_id FK
        timestamp received_at
        text reported_issue
        text diagnosis
        text work_performed
        string technician_name
        date estimated_delivery_date
        timestamp delivered_at
        enum status
        text observations
        uuid created_by
        timestamp created_at
        timestamp updated_at
    }
    REPAIR_ORDER_STATUS_HISTORY {
        uuid id PK
        uuid repair_order_id FK
        enum from_status
        enum to_status
        text note
        uuid changed_by
        timestamp changed_at
    }
```

## Constraints and rules

- **Clients**: unique `(identification_type, identification_number)` to prevent duplicates.
- **Engines**: unique `serial_number`.
- **Repair orders**: unique `order_number`. The client is stored on the order as a snapshot of the owner at reception, and must match the engine's owner when the order is created.
- **Status**: `received`, `in_diagnosis`, `awaiting_approval`, `in_repair`, `in_testing`, `finished`, `delivered`. Every change creates a row in `repair_order_status_history`.
- **Technician**: stored as reference text; no user account is required.
- **Soft delete**: clients and engines are deactivated (`is_active = false`) instead of being removed, so the order history is preserved.

## Indexes

| Table | Index | Reason |
| --- | --- | --- |
| `engines` | `client_id` | Engines of a client |
| `repair_orders` | `status` | Dashboard and status filter |
| `repair_orders` | `client_id`, `engine_id` | Filters by client and engine |
| `repair_orders` | `(created_at, id)` | Keyset pagination |
| `repair_order_status_history` | `(repair_order_id, changed_at)` | Order timeline |

## Initialization

- The PostgreSQL container runs `infrastructure/scripts/postgres/01-create-databases.sh` on first start to create both databases and their roles.
- Each service applies its own schema with its migration tool (Alembic for `business-api`, Prisma for `auth-api`).
