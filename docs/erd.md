# Entity-Relationship Diagram

Data model for the Dental Laboratory Management Platform (15 entities). All
tables use UUID primary keys and `created_at` / `updated_at` timestamps;
soft-delete (`deleted_at`) is applied where noted in the entities.

```mermaid
erDiagram
    USER ||--o| DENTIST : "has profile"
    USER ||--o{ NOTIFICATION : receives
    DENTIST ||--o{ CASE : submits
    DENTIST ||--o{ INVOICE : "billed to"
    DENTIST ||--o{ MONTHLY_STATEMENT : "statements"
    CASE_TYPE ||--o{ CASE : categorizes
    CASE_TYPE ||--o{ PRICING_RULE : priced_by
    CASE_STATUS ||--o{ CASE : "current status"
    CASE_STATUS ||--o{ CASE_STATUS_HISTORY : recorded_in
    CASE ||--o{ CASE_FILE : has
    CASE ||--o{ CASE_STATUS_HISTORY : transitions
    CASE ||--o{ INVOICE : "billed by"
    INVOICE ||--o{ INVOICE_LINE_ITEM : contains
    USER ||--o{ CASE_STATUS_HISTORY : changed_by
    USER ||--o{ CASE_FILE : uploaded_by

    USER {
        uuid id PK
        string email UK
        string password_hash
        enum role "dentist|admin|super_admin"
        enum status "active|disabled|invited"
        timestamp last_login_at
    }
    DENTIST {
        uuid id PK
        uuid user_id FK
        string clinic_name
        string tier
    }
    CASE {
        uuid id PK
        string reference UK
        uuid dentist_id FK
        uuid case_type_id FK
        uuid current_status_id FK
        string patient_reference
        timestamp submitted_at
    }
    CASE_TYPE {
        uuid id PK
        string name
        string slug UK
        boolean is_active
    }
    CASE_STATUS {
        uuid id PK
        string label
        string slug UK
        int sort_order
        boolean is_terminal
    }
    CASE_STATUS_HISTORY {
        uuid id PK
        uuid case_id FK
        uuid case_status_id FK
        uuid changed_by_user_id FK
    }
    CASE_FILE {
        uuid id PK
        uuid case_id FK
        enum file_type "stl|image|document|lab_output"
        string stored_path
        bigint size_bytes
    }
    PRICING_RULE {
        uuid id PK
        uuid case_type_id FK
        string dentist_tier
        decimal price
        date effective_from
    }
    INVOICE {
        uuid id PK
        string number UK
        uuid dentist_id FK
        uuid case_id FK
        decimal total
        enum status "draft|issued|paid|cancelled|refunded"
        string stripe_payment_intent_id
    }
    INVOICE_LINE_ITEM {
        uuid id PK
        uuid invoice_id FK
        string description
        decimal total
    }
    MONTHLY_STATEMENT {
        uuid id PK
        uuid dentist_id FK
        int period_year
        int period_month
        decimal closing_balance
    }
    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        enum type
        enum channel "email|in_app"
        enum status "pending|sent|failed|read"
    }
    CONTACT_MESSAGE {
        uuid id PK
        string email
        boolean is_handled
    }
    AUDIT_LOG {
        uuid id PK
        uuid user_id
        string action
        string entity_type
        jsonb metadata
    }
    PLATFORM_SETTING {
        uuid id PK
        string key UK
        text value
        boolean is_secret
    }
```
