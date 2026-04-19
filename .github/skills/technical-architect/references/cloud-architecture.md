# Cloud Architecture Reference

## AWS Architecture

### Compute
```
EC2          → General VMs, lift-and-shift, GPU (P/G instances)
ECS (Fargate)→ Containers tanpa manage server, cocok untuk microservices
EKS          → Kubernetes managed, portabilitas tinggi
Lambda       → Serverless, event-driven, < 15 menit runtime
App Runner   → Container → URL dalam menit, zero infra management
Batch        → Large-scale batch jobs, HPC workloads
```

### Networking
```
VPC          → Isolated network, subnet public/private, NACL + SG
ALB          → HTTP/HTTPS L7, path-based routing, WebSocket, gRPC
NLB          → TCP/UDP L4, ultra-low latency, static IP, TLS passthrough
CloudFront   → CDN global, edge caching, WAF integration, Lambda@Edge
Route 53     → DNS, health check, latency/geo/weighted routing
API Gateway  → REST/HTTP/WebSocket API, auth, throttling, caching
VPC Peering  → Koneksi private antar VPC (sama/beda account/region)
Transit GW   → Hub-and-spoke untuk koneksi banyak VPC
Direct Connect→ Dedicated line ke AWS (bukan internet)
```

### Storage & Database
```
S3           → Object storage, 11 nines durability, lifecycle policy
EBS          → Block storage untuk EC2, gp3 default, io2 untuk IOPS tinggi
EFS          → Shared NFS filesystem, auto-scale
RDS          → Managed relational (MySQL, PostgreSQL, SQL Server, Oracle)
Aurora       → MySQL/PostgreSQL compatible, 5x faster, auto-scale storage
Aurora Serverless v2 → Scale to zero, variable workload
DynamoDB     → Key-value + document, single-digit ms, serverless
ElastiCache  → Redis/Memcached managed, in-memory caching
Redshift     → Data warehouse, columnar, petabyte-scale
DocumentDB   → MongoDB-compatible managed
Keyspaces    → Cassandra-compatible managed
Neptune      → Graph database managed
Timestream   → Time-series managed
```

### Security
```
IAM          → Users, roles, policies, identity federation
STS          → Temporary credentials, AssumeRole
Cognito      → User pool (auth), identity pool (federated identity)
WAF          → Web Application Firewall, rate limiting, geo blocking
Shield       → DDoS protection (Standard free, Advanced $3000/month)
GuardDuty    → Threat detection, ML-based anomaly detection
Security Hub → Centralized security posture
Inspector    → Vulnerability scanning (EC2, Lambda, ECR)
Macie        → S3 sensitive data discovery
KMS          → Key management, envelope encryption
Secrets Manager → Secrets rotation, cross-account
ACM          → TLS certificates gratis, auto-renewal
CloudTrail   → API audit log, compliance
Config       → Resource configuration history + compliance rules
```

### Observability
```
CloudWatch   → Metrics, logs, alarms, dashboards, Synthetics
X-Ray        → Distributed tracing, service map
CloudWatch Container Insights → EKS/ECS metrics
CloudWatch Application Insights → .NET, Java app monitoring
```

### Messaging & Integration
```
SQS          → Message queue, standard (at-least-once) + FIFO (exactly-once)
SNS          → Pub/sub fanout, email, SMS, HTTP, Lambda trigger
EventBridge  → Event bus, SaaS integration, scheduled rules
Kinesis Data Streams → Real-time streaming, replay, Kafka alternative
Kinesis Firehose     → Streaming ETL → S3/Redshift/Elasticsearch
MSK          → Managed Apache Kafka
Step Functions → Serverless workflow orchestration
AppSync      → Managed GraphQL, real-time subscriptions
```

### Well-Architected Best Practices (AWS)
```
Multi-AZ deployment     → Minimum 2 AZ untuk production workloads
Auto Scaling            → Scale out/in berdasarkan metrics
Immutable infrastructure→ Replace, don't patch (AMI baking, containers)
Infrastructure as Code  → CloudFormation, CDK, Terraform
Tagging strategy        → env, team, cost-center, project untuk cost allocation
Cost optimization       → Reserved/Savings Plans (1-3 tahun) untuk predictable workload
                          Spot instances untuk batch/fault-tolerant workload
```

---

## GCP Architecture

### Compute
```
Compute Engine (GCE) → VMs, preemptible untuk cost saving
GKE (Autopilot)      → Kubernetes managed, Autopilot = zero node management
Cloud Run            → Serverless containers, scale-to-zero, HTTP/gRPC
Cloud Functions      → Serverless functions, event-driven
Batch                → HPC dan batch processing
Cloud Run Jobs       → Batch container jobs
```

### Networking
```
VPC                  → Global VPC (beda dari AWS yang regional)
Cloud Load Balancing → Global anycast, HTTP/TCP/UDP, single IP worldwide
Cloud CDN            → Cache konten, Cloud Armor untuk WAF
Cloud DNS            → Managed DNS
Cloud Armor          → WAF + DDoS protection
Traffic Director     → Service mesh control plane
VPC Service Controls → Perimeter keamanan untuk GCP services
Cloud NAT            → Outbound internet dari private instance
Interconnect         → Dedicated/Partner, pengganti Direct Connect
```

### Storage & Database
```
Cloud Storage (GCS)  → Object storage, multi-region/dual-region/regional
Persistent Disk      → Block storage, pd-ssd default
Filestore            → Managed NFS
Cloud SQL            → MySQL, PostgreSQL, SQL Server managed
Cloud Spanner        → Globally distributed, strong consistency, SQL
Firestore            → Document DB, serverless, real-time sync
BigQuery             → Serverless data warehouse, SQL, ML built-in
Bigtable             → Wide-column, petabyte, low latency (HBase compatible)
Memorystore          → Redis/Memcached managed
AlloyDB              → PostgreSQL-compatible, 4x faster analytical
```

### Security
```
IAM                  → Service accounts, workload identity, org policies
Cloud Identity       → Identity provider, SSO
Secret Manager       → Secrets management
Cloud KMS            → Key management, HSM option
Binary Authorization → Container image signing & verification
Security Command Center → Security posture management
Chronicle            → SIEM, threat intelligence
Assured Workloads    → Compliance controls (FedRAMP, HIPAA, IL4)
VPC Service Controls → Perimeter security untuk API access
```

### BigQuery Architecture Patterns
```
Data Lake    : GCS (raw) → BigQuery (processed) → Looker (BI)
Streaming    : Pub/Sub → Dataflow → BigQuery
Batch ETL    : GCS → Dataflow/Dataproc → BigQuery
ML Pipeline  : BigQuery → Vertex AI → Model Registry → Prediction Endpoint
```

---

## Azure Architecture

### Compute
```
Azure VMs            → IaaS, berbagai SKU (B-series hemat, N-series GPU)
AKS                  → Kubernetes managed
Azure Container Apps → Serverless containers, microservices
Azure Functions      → Serverless, event-driven
App Service          → PaaS web hosting, auto-scale
```

### Networking
```
Virtual Network (VNet) → Isolated network, peering
Application Gateway  → L7 load balancer, WAF, SSL termination
Azure Front Door     → Global CDN + L7 LB + WAF
Azure Load Balancer  → L4, internal/public
Azure DNS            → Managed DNS
ExpressRoute         → Dedicated connectivity (Direct Connect equivalent)
Azure Firewall       → Managed firewall, FQDN filtering
DDoS Protection      → Standard tier untuk production
Private Link         → Private endpoint untuk PaaS services
```

### Storage & Database
```
Blob Storage         → Object storage, hot/cool/archive tiers
Azure Files          → SMB/NFS file shares
Azure Disks          → Block storage (Premium SSD, Ultra Disk)
Azure SQL Database   → SQL Server managed, serverless tier
Cosmos DB            → Multi-model, globally distributed, 5 consistency levels
Azure Database for PostgreSQL → Flexible Server, pgvector support
Azure Cache for Redis → Redis managed
Synapse Analytics    → Data warehouse + Spark + Data Lake integrated
```

### Security & Identity
```
Azure AD (Entra ID)  → Identity platform, SSO, MFA, Conditional Access
Azure AD B2C         → Customer identity (CIAM)
Key Vault            → Secrets, certificates, keys
Microsoft Defender   → Cloud security posture, workload protection
Azure Policy         → Governance at scale, compliance
Privileged Identity Management (PIM) → Just-in-time privileged access
Microsoft Sentinel   → Cloud-native SIEM/SOAR
```

---

## Multi-Cloud & Hybrid Patterns

### Kubernetes Multi-Cloud
```
Anthos (GCP)    → Run GKE anywhere (on-prem, AWS, Azure)
EKS Anywhere    → Run EKS on-prem
Arc (Azure)     → Manage Kubernetes anywhere from Azure

Service Mesh    → Istio untuk traffic management cross-cluster
GitOps          → ArgoCD/Flux untuk deployment konsisten
```

### Data Residency & Sovereignty
```
Strategi data residency:
1. Store semua data di region/country yang diizinkan regulasi
2. Gunakan data residency controls dari cloud provider
3. Enkripsi dengan customer-managed keys (CMEK/BYOK)
4. Audit log untuk semua akses data
```

### Cost Optimization Cross-Cloud
```
FinOps Practices:
- Rightsizing: match instance size dengan actual usage
- Reserved/Committed Use: diskon 30-60% vs on-demand
- Spot/Preemptible: 60-90% hemat untuk fault-tolerant workload
- Autoscaling: scale-to-zero saat tidak ada traffic
- Storage tiering: pindah data lama ke cold/archive storage
- Tag-based cost allocation: alokasi biaya per team/product
```