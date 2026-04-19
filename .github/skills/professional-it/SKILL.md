---
name: professional-it
description: >
  Skill untuk profesional IT dan pengembang perangkat lunak tingkat industri. Gunakan skill
  ini kapan pun pengguna membutuhkan bantuan terkait: arsitektur sistem dan software design,
  DevOps dan CI/CD pipeline, cloud computing (AWS, GCP, Azure), keamanan siber (cybersecurity),
  database design dan optimasi query, API design (REST, GraphQL, gRPC), microservices,
  containerisasi (Docker, Kubernetes), Infrastructure as Code (Terraform, Ansible),
  code review dan best practices, debugging dan troubleshooting sistem, dokumentasi teknis
  (RFC, ADR, runbook), sertifikasi IT (AWS, GCP, Azure, CISSP, PMP), incident management,
  system design interview, performance tuning, atau topik IT profesional lainnya.
  Aktif untuk kata kunci seperti "bantu desain sistem", "review kode saya", "setup CI/CD",
  "troubleshoot error ini", "buat dokumentasi teknis", "arsitektur microservices", dsb.
---

# Skill Profesional IT

Skill ini dirancang untuk membantu profesional IT — software engineer, DevOps/SRE, cloud
architect, security engineer, data engineer, dan IT manager — dalam pekerjaan teknis
sehari-hari dengan standar industri yang berlaku.

---

## 1. Identifikasi Konteks

Sebelum membantu, identifikasi:
- **Peran**: Software Engineer / DevOps / SRE / Cloud Architect / Security / DBA / Manager
- **Stack teknologi**: bahasa, framework, platform, cloud provider
- **Skala sistem**: startup / mid-size / enterprise / distributed
- **Konteks**: greenfield project / legacy modernization / incident response / review
- **Output yang diharapkan**: kode / diagram / dokumen / penjelasan konsep

---

## 2. Domain & Prosedur

### A. Software Architecture & System Design

**Pendekatan:**
1. Clarify requirements (functional & non-functional)
2. Estimasi kapasitas (QPS, storage, bandwidth)
3. High-level design → komponen utama
4. Detail design → data model, API, algoritma
5. Identifikasi trade-off dan bottleneck

**Pola arsitektur yang umum digunakan:**
- Monolith → Modular Monolith → Microservices
- Event-Driven Architecture (EDA)
- CQRS + Event Sourcing
- Hexagonal / Clean Architecture
- Strangler Fig Pattern (modernisasi legacy)

**Format diagram yang direkomendasikan:**
```
Gunakan notasi C4 Model:
- Level 1: Context Diagram (sistem & pengguna)
- Level 2: Container Diagram (aplikasi & database)
- Level 3: Component Diagram (internal komponen)
- Level 4: Code Diagram (class/method, jika perlu)
```

**Non-functional requirements (NFRs) yang harus dipertimbangkan:**
- Availability: SLA target (99.9% / 99.99%)
- Latency: P50, P95, P99
- Throughput: RPS / TPS
- Consistency vs. Availability (CAP theorem)
- Scalability: horizontal vs. vertical
- Security: auth, encryption, compliance

### B. DevOps & CI/CD

**Pipeline standar industri:**
```
Code Push → Lint & Test → Build → Security Scan → Staging Deploy → Integration Test → Production Deploy
```

**Tools yang umum:**
- CI/CD: GitHub Actions, GitLab CI, Jenkins, CircleCI, ArgoCD
- Containerisasi: Docker, Podman
- Orkestrasi: Kubernetes (K8s), Helm, Kustomize
- IaC: Terraform, Pulumi, Ansible, CloudFormation
- Monitoring: Prometheus + Grafana, Datadog, New Relic
- Logging: ELK Stack, Loki + Grafana, Splunk

**Best practices GitOps:**
- Deklaratif infrastructure
- Git sebagai source of truth
- Pull-based deployment (ArgoCD/Flux)
- Separation: app repo vs. config repo

**Contoh GitHub Actions workflow:**
```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          npm ci
          npm test
  
  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t $IMAGE_NAME:$GITHUB_SHA .
      - name: Push to registry
        run: docker push $IMAGE_NAME:$GITHUB_SHA
```

### C. Cloud Computing

**AWS — Layanan utama per kategori:**
- Compute: EC2, ECS, EKS, Lambda, Fargate
- Storage: S3, EBS, EFS, Glacier
- Database: RDS, Aurora, DynamoDB, ElastiCache, Redshift
- Networking: VPC, ALB/NLB, Route 53, CloudFront, Direct Connect
- Security: IAM, KMS, Secrets Manager, WAF, Shield
- Monitoring: CloudWatch, X-Ray, CloudTrail

**GCP — Layanan utama:**
- Compute: GCE, GKE, Cloud Run, Cloud Functions
- Storage: GCS, Persistent Disk, Filestore
- Database: Cloud SQL, Spanner, Firestore, Bigtable, BigQuery
- Networking: VPC, Cloud Load Balancing, Cloud CDN, Cloud DNS

**Azure — Layanan utama:**
- Compute: Azure VM, AKS, Azure Functions, Container Apps
- Storage: Blob Storage, Azure Files, Managed Disks
- Database: Azure SQL, Cosmos DB, Azure Cache for Redis
- Identity: Azure AD, Managed Identities

**Prinsip Well-Architected Framework (berlaku di semua cloud):**
1. Operational Excellence
2. Security
3. Reliability
4. Performance Efficiency
5. Cost Optimization
6. (AWS tambahkan: Sustainability)

### D. Security & Cybersecurity

**Pendekatan Defense in Depth:**
```
Perimeter → Network → Host → Application → Data
```

**OWASP Top 10 (Web Application):**
1. Broken Access Control
2. Cryptographic Failures
3. Injection (SQL, NoSQL, Command)
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable & Outdated Components
7. Identification & Auth Failures
8. Software & Data Integrity Failures
9. Security Logging & Monitoring Failures
10. Server-Side Request Forgery (SSRF)

**Secure Coding Practices:**
- Input validation & sanitization
- Parameterized queries (anti SQL injection)
- Output encoding (anti XSS)
- Principle of least privilege
- Secrets management (jangan hardcode credentials)
- Dependency scanning (Snyk, Dependabot, OWASP Dependency-Check)

**Incident Response (NIST Framework):**
```
Preparation → Detection → Containment → Eradication → Recovery → Lessons Learned
```

### E. Database Design & Optimization

**Relational (PostgreSQL, MySQL, SQL Server):**
- Normalisasi: 1NF → 2NF → 3NF → BCNF
- Indexing strategy: B-tree, Hash, GiST, GIN, partial index
- Query optimization: EXPLAIN ANALYZE, query plan, index hints
- Connection pooling: PgBouncer, HikariCP
- Partitioning: range, list, hash

**NoSQL:**
- Document (MongoDB, Firestore): embed vs. reference pattern
- Key-Value (Redis): caching, session, pub/sub, rate limiting
- Column-family (Cassandra): partition key design, wide rows
- Graph (Neo4j): node/edge/property model

**Data Modeling Best Practices:**
- Pilih tipe data paling kecil yang cukup
- Hindari NULL berlebihan
- Gunakan UUID atau snowflake ID untuk distributed system
- Timestamp dengan timezone (TIMESTAMPTZ)
- Soft delete dengan `deleted_at` column

### F. API Design

**REST Best Practices:**
```
GET    /api/v1/users           → List users
GET    /api/v1/users/{id}      → Get user
POST   /api/v1/users           → Create user
PUT    /api/v1/users/{id}      → Replace user
PATCH  /api/v1/users/{id}      → Partial update
DELETE /api/v1/users/{id}      → Delete user
```

- Gunakan HTTP status code yang tepat (200, 201, 400, 401, 403, 404, 409, 422, 500)
- Versioning: URI versioning (/v1/) atau Header versioning
- Pagination: cursor-based (lebih scalable) atau offset-based
- Rate limiting dengan header `X-RateLimit-*`
- OpenAPI/Swagger untuk dokumentasi

**GraphQL:**
- Query, Mutation, Subscription
- Schema-first design
- Hindari N+1 problem dengan DataLoader
- Persisted queries untuk production

### G. Code Review & Best Practices

**Checklist Code Review:**
- [ ] Logic benar dan sesuai requirements
- [ ] Edge cases ditangani
- [ ] Error handling memadai
- [ ] Tidak ada magic numbers/strings
- [ ] Naming jelas dan konsisten
- [ ] DRY (Don't Repeat Yourself)
- [ ] SOLID principles diikuti
- [ ] Unit test mencukupi (coverage > 80%)
- [ ] Tidak ada secrets/credentials dalam kode
- [ ] Dokumentasi/komentar untuk logika kompleks
- [ ] Performance tidak ada obvious bottleneck

### H. Dokumentasi Teknis

**RFC (Request for Comments):**
```markdown
# RFC-XXX: Judul Proposal

## Status: Draft / Review / Accepted / Rejected
## Author: Nama
## Date: YYYY-MM-DD

## Summary
Deskripsi singkat perubahan yang diusulkan.

## Motivation
Mengapa ini diperlukan? Masalah apa yang dipecahkan?

## Design
Solusi teknis yang diusulkan secara detail.

## Alternatives Considered
Opsi lain yang dipertimbangkan dan alasan tidak dipilih.

## Trade-offs
Kelebihan dan kekurangan solusi.

## Implementation Plan
Langkah-langkah implementasi dan timeline.
```

**ADR (Architecture Decision Record):**
```markdown
# ADR-XXX: Judul Keputusan

## Status: Proposed / Accepted / Deprecated / Superseded

## Context
Situasi yang memaksa keputusan ini dibuat.

## Decision
Keputusan yang diambil.

## Consequences
Dampak positif dan negatif dari keputusan ini.
```

**Runbook:**
```markdown
# Runbook: Nama Prosedur

## Tujuan
## Prasyarat
## Langkah-langkah
## Verifikasi
## Rollback
## Kontak Eskalasi
```

### I. Incident Management & On-Call

**Severity Levels:**
| Level | Dampak | Response Time |
|-------|--------|---------------|
| SEV-1 | Sistem down, seluruh pengguna terdampak | Segera (<15 menit) |
| SEV-2 | Fitur kritis terganggu, sebagian pengguna | <30 menit |
| SEV-3 | Degradasi performa, workaround tersedia | <2 jam |
| SEV-4 | Masalah minor, tidak urgent | <24 jam |

**Post-mortem template (blameless):**
1. Summary of incident
2. Timeline (kapan terjadi, kapan terdeteksi, kapan resolved)
3. Root cause analysis (5 Whys)
4. Impact assessment
5. Action items (preventive & detective)

---

## 3. Format Respons Teknis

**Untuk kode:** Selalu sertakan:
- Bahasa/framework/versi
- Komentar untuk logika non-obvious
- Contoh penggunaan
- Catatan tentang production-readiness

**Untuk arsitektur:** Sertakan:
- Trade-off yang dipertimbangkan
- Asumsi yang dibuat
- Skalabilitas dan limitasinya

**Untuk troubleshooting:** Gunakan pendekatan:
1. Reproduksi masalah
2. Isolasi komponen
3. Hipotesis → validasi
4. Root cause → solusi
5. Pencegahan ke depan

---

## 4. Referensi Tambahan

- `references/system-design-patterns.md` — Pola desain sistem yang umum
- `references/cloud-services-comparison.md` — Perbandingan layanan AWS/GCP/Azure

---

## 5. Standar Profesional

- Selalu pertimbangkan **keamanan** sebagai first-class concern
- Prioritaskan **readability** dan **maintainability** di atas cleverness
- Dokumentasikan **keputusan** bukan hanya implementasi
- Pikirkan **failure modes** dan bagaimana sistem gagal secara graceful
- Ikuti prinsip **YAGNI** (You Aren't Gonna Need It) untuk menghindari over-engineering