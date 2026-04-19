# Architecture Patterns Catalog

## 1. Event-Driven Architecture (EDA)

### Konsep Dasar
```
Publisher → [Event Broker] → Subscriber(s)
               (Kafka/SNS/EventBridge)
```

### Event Types
```
Domain Event    : Sesuatu yang terjadi dalam domain bisnis
                  "OrderPlaced", "PaymentProcessed", "ItemShipped"

Integration Event: Event untuk komunikasi antar bounded context/service

Command         : Instruksi untuk melakukan sesuatu (directed, 1:1)
Query           : Permintaan data (sync)
```

### Event Schema Best Practices
```json
{
  "eventId": "uuid-v7",
  "eventType": "order.placed",
  "eventVersion": "1.0",
  "aggregateId": "order-123",
  "aggregateType": "Order",
  "occurredAt": "2024-01-15T10:30:00Z",
  "payload": {
    "orderId": "order-123",
    "customerId": "cust-456",
    "totalAmount": 150000
  },
  "metadata": {
    "correlationId": "req-789",
    "causationId": "prev-event-id",
    "userId": "user-123"
  }
}
```

### Kafka Architecture Patterns
```
Topic Partitioning:
  - Partition by entity ID → ordering terjamin per entity
  - Partition by tenant → isolasi data per customer
  - Partition by region → locality

Consumer Groups:
  - Satu consumer group = satu logical subscriber
  - Tiap partition diassign ke satu consumer dalam group
  - Scale: tambah consumer = parallel processing

Offset Management:
  - Auto-commit: simple, risiko reprocess saat failure
  - Manual commit: after processing = at-least-once (safer)
  - Exactly-once: Kafka transactions (kompleks, pakai jika critical)
```

---

## 2. CQRS (Command Query Responsibility Segregation)

### Struktur
```
Write Side (Command):
  Command → Command Handler → Domain Model → Event Store / Write DB
                                          → Domain Events → Event Bus

Read Side (Query):
  Query → Query Handler → Read Model (denormalized, optimized)
                        ← Event Handler memperbarui Read Model
```

### Kapan Gunakan CQRS
```
✅ Read dan write memiliki load yang sangat berbeda
✅ Read model butuh representasi data yang sangat berbeda dari write model
✅ Multiple read model untuk use case berbeda (dashboard, report, API)
✅ Event sourcing (hampir selalu berpasangan)

❌ Hindari untuk sistem sederhana CRUD
❌ Tim kecil dengan deadline ketat
❌ Eventual consistency tidak bisa diterima
```

### Eventual Consistency Handling
```
Strategi untuk user experience yang baik:
1. Optimistic UI update → update UI sebelum server confirm
2. Polling → client poll sampai read model update
3. WebSocket/SSE → server push saat read model ready
4. Return updated data dari command → bypass read model sementara
```

---

## 3. Saga Pattern (Distributed Transactions)

### Masalah yang Dipecahkan
```
Microservices tidak bisa ACID transaction lintas service.
Saga = sequence of local transactions dengan compensating transactions.
```

### Choreography Saga
```
Service A → Event → Service B → Event → Service C
                                              ↓ (failure)
                              Compensate B ← Event
              Compensate A ← Event
```
**Cocok untuk:** Simple flow, ≤ 3-4 services

### Orchestration Saga
```
Saga Orchestrator → Command → Service A → Reply
                 → Command → Service B → Reply
                 → Command → Service C → Reply (failure)
                 → Compensating Command → Service B
                 → Compensating Command → Service A
```
**Cocok untuk:** Complex flow, banyak services, butuh visibility

### Compensating Transactions
```
Setiap step HARUS punya compensating action:
  "ReserveInventory"    ↔ "ReleaseInventory"
  "ChargeCreditCard"    ↔ "RefundCreditCard"
  "CreateShipment"      ↔ "CancelShipment"
```

---

## 4. Outbox Pattern

### Masalah
```
Service butuh:
1. Simpan data ke DB
2. Publish event ke message broker

Jika keduanya tidak atomic → inconsistency
```

### Solusi
```
Dalam 1 DB transaction:
  → Simpan data ke tabel bisnis
  → Simpan event ke tabel "outbox"

Background worker (Transactional Outbox Processor):
  → Poll tabel outbox
  → Publish ke Kafka/SQS
  → Mark as published

Tools: Debezium (CDC-based), Transactional Outbox library
```

### Implementasi Tabel Outbox
```sql
CREATE TABLE outbox_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id VARCHAR(255) NOT NULL,
  event_type   VARCHAR(255) NOT NULL,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  retry_count  INT DEFAULT 0
);

CREATE INDEX idx_outbox_unpublished ON outbox_events(created_at)
  WHERE published_at IS NULL;
```

---

## 5. Strangler Fig Pattern

### Untuk Modernisasi Legacy System
```
Phase 1: Pasang "facade/proxy" di depan legacy
         Request → [Proxy] → Legacy

Phase 2: Pindahkan fitur satu per satu ke service baru
         Request → [Proxy] → Service Baru (fitur X, Y)
                           → Legacy (fitur Z yang belum dipindah)

Phase 3: Setelah semua fitur dipindah, hapus legacy
         Request → [API Gateway/New Services]
```

### Tips Sukses
```
- Mulai dari fitur yang paling sedikit coupled
- Jaga data synchronization selama transisi (dual-write atau CDC)
- Feature flag untuk rollback mudah
- Track coverage yang sudah dimigrasikan
- Jangan refactor dan strangler fig sekaligus — satu per satu
```

---

## 6. BFF (Backend for Frontend)

### Konsep
```
Mobile App   → [BFF Mobile]   → Microservices
Web App      → [BFF Web]      → Microservices
Third-party  → [Public API]   → Microservices
```

### Manfaat
```
- Setiap client dapat API yang optimized untuk kebutuhannya
- Aggregasi data dari multiple services dilakukan di BFF
- Frontend team bisa own BFF mereka
- Reduce over-fetching/under-fetching
```

### BFF vs API Gateway
```
API Gateway  → Cross-cutting concerns (auth, rate limit, routing, logging)
BFF          → Business logic, data aggregation, transformation per client

Bisa coexist: Client → API Gateway → BFF → Microservices
```

---

## 7. Service Mesh

### Kapan Butuh Service Mesh
```
✅ > 10 microservices
✅ Butuh mTLS antar service (zero-trust network)
✅ Butuh observability detail (traces, metrics per service pair)
✅ Butuh traffic management canary, A/B testing
✅ Butuh circuit breaking, retry, timeout di network level

❌ ≤ 5 services → overkill
❌ Tim belum familiar dengan Kubernetes → overhead besar
```

### Istio Architecture
```
Control Plane: istiod
  - Pilot: service discovery, traffic management config
  - Citadel: certificate management (mTLS)
  - Galley: configuration validation

Data Plane: Envoy sidecar di setiap pod
  - Intercept semua inbound/outbound traffic
  - Apply policy, collect telemetry
```

### Key Features
```
Traffic Management:
  VirtualService  → Routing rules (canary, mirror, retry, timeout)
  DestinationRule → Load balancing, circuit breaking, mTLS

Security:
  PeerAuthentication  → mTLS requirement
  AuthorizationPolicy → L7 access control

Observability:
  Automatic metrics, traces (Jaeger), access logs
```

---

## 8. Hexagonal Architecture (Ports & Adapters)

### Konsep
```
                    [UI Adapter]
                         ↓
[DB Adapter] ← [DOMAIN CORE] → [API Adapter]
                         ↑
                  [Message Adapter]

Domain tidak tahu tentang framework, DB, atau transport layer.
```

### Layer Boundaries
```
Domain Layer     → Business logic, entities, value objects, domain services
                   Tidak boleh import framework atau infra

Application Layer→ Use cases / application services
                   Orchestrate domain, tidak ada business logic

Infrastructure   → DB, HTTP clients, message brokers, file system
                   Implementasi port yang didefinisikan domain

Interface        → HTTP controllers, CLI, gRPC handlers, message consumers
```

### Benefit
```
✅ Highly testable (domain bisa ditest tanpa DB/HTTP)
✅ Mudah ganti infra (swap MySQL → PostgreSQL tanpa ubah domain)
✅ Clear separation of concerns
✅ Cocok dengan DDD

❌ Lebih banyak boilerplate
❌ Overkill untuk CRUD sederhana
```

---

## 9. Data Mesh

### Konsep (vs Data Warehouse)
```
Data Warehouse/Lake (centralized):
  Source Systems → ETL → Central Data Lake → Analytics
  Masalah: bottleneck, single team, domain knowledge loss

Data Mesh (decentralized):
  Setiap domain team own data mereka sebagai "data product"
  Konsumer bisa subscribe ke data product tim lain
```

### 4 Prinsip Data Mesh
```
1. Domain-oriented ownership → Tim domain own data pipeline & product
2. Data as a Product         → Data harus discoverable, understandable, trustworthy
3. Self-serve platform       → Platform untuk create/consume data produk mudah
4. Federated governance      → Standards global, ownership lokal
```

### Implementation Stack
```
Data Catalog   : DataHub, Apache Atlas, Collibra
Data Contract  : Schema registry, OpenAPI-style contract untuk data
Data Quality   : Great Expectations, dbt tests, Monte Carlo
Storage        : Domain-specific lakehouse (Delta Lake, Apache Iceberg)
Compute        : Databricks, Spark, dbt per domain
```

---

## Trade-off Summary Matrix

| Kebutuhan | Pattern Recommended |
|---|---|
| Loose coupling, async | Event-Driven Architecture |
| High read load, complex queries | CQRS + Read Model |
| Distributed transaction | Saga (Orchestration) |
| Dual-write safety | Outbox Pattern |
| Legacy modernization | Strangler Fig |
| Multi-client API | BFF Pattern |
| Zero-trust microservices | Service Mesh |
| Clean domain separation | Hexagonal Architecture |
| Decentralized data ownership | Data Mesh |
| Time-travel & audit trail | Event Sourcing |