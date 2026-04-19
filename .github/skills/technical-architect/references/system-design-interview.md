# System Design Interview — Framework & Contoh

## Framework Jawaban (45 menit)

```
Menit  0– 5 : Clarify requirements & constraints
Menit  5–10 : Estimasi kapasitas
Menit 10–20 : High-level design
Menit 20–35 : Deep dive komponen kritis
Menit 35–45 : Scale, bottleneck, edge cases
```

### Menit 0–5: Clarify Requirements

Jangan langsung desain! Tanyakan dulu:
```
"Apakah ini sistem baru atau existing?"
"Berapa DAU yang harus disupport?"
"Apakah kita butuh mobile support?"
"Fitur mana yang paling kritis di-handle first?"
"Ada requirement geography? (global atau 1 region?)"
"SLA availability berapa? Ada compliance requirement?"
```

### Menit 5–10: Capacity Estimation

Hitung dengan cepat, tunjukkan reasoning:
```
DAU: X juta
Avg request/user/hari: Y
Peak RPS: (X × Y / 86400) × 10 = Z RPS

Storage:
  Data per event: S bytes
  Events/hari: E
  5 tahun: E × 365 × 5 × S = Total

Bandwidth:
  Read-heavy: 80% read, 20% write
  Read RPS × avg payload = bandwidth
```

---

## Contoh System Design Lengkap

### Case 1: Design URL Shortener (TinyURL)

**Requirements:**
- Functional: shorten URL, redirect, custom alias, analytics
- Non-functional: 100M URLs/hari dibuat, 10:1 read:write ratio, low latency redirect

**Capacity Estimation:**
```
Write: 100M/hari = ~1200 URL/detik
Read: 10 × 1200 = 12.000 redirect/detik

Storage per URL: ~500 bytes
5 tahun: 100M × 365 × 5 × 500B = ~90 TB
```

**High-Level Design:**
```
User → CDN → Load Balancer → [URL Shortener Service] → Cache (Redis)
                                      ↓                      ↓ miss
                              [Analytics Service]         [DB: Cassandra]
                                      ↓
                              [Message Queue (Kafka)]
                                      ↓
                              [Analytics Worker] → [TimeSeries DB]
```

**Key Design Decisions:**

*URL Generation:*
```
Opsi A: MD5/SHA256 hash → ambil 6-8 karakter pertama
  ✅ Deterministic, bisa detect duplicate
  ❌ Collision lebih mungkin, hash computation overhead

Opsi B: Base62 encoding dari auto-increment ID
  ✅ Sederhana, no collision, predictable length
  ❌ Sequential, bisa di-enumerate

Opsi C: Dedicated ID generation service (Snowflake-like)
  ✅ Distributed, no collision, high throughput
  ❌ Lebih kompleks

🎯 Rekomendasi: Opsi B untuk start, Opsi C untuk skala besar
```

*Database:*
```
Opsi A: MySQL/PostgreSQL
  ✅ ACID, familiar, simple
  ❌ Sulit scale horizontal untuk 90TB

Opsi B: Cassandra
  ✅ Horizontal scale, high write throughput, geo-distribution
  ❌ Eventual consistency, no JOIN

🎯 Rekomendasi: Cassandra untuk URL store (key-value pattern cocok)
   PostgreSQL untuk user/account data
```

*Caching:*
```
Redis dengan LRU eviction
Cache popular URLs (20% URL = 80% traffic — Pareto)
TTL: 24 jam untuk redirect cache
Cache hit ratio target: >90%
```

**Scale Considerations:**
```
Bottleneck 1: Redirect latency
  → Cache in Redis, CDN untuk sangat popular URLs
  → Geo-distributed Cassandra nodes

Bottleneck 2: Write throughput URL creation
  → Rate limiting per user
  → Async analytics (jangan block redirect untuk track analytics)

Bottleneck 3: Custom alias collision
  → Optimistic locking atau distributed lock (Redlock)
```

---

### Case 2: Design Instagram/Photo Sharing

**Requirements:**
- Upload foto, follow, feed (home timeline), like, comment
- 500M DAU, 100M foto di-upload/hari

**Capacity Estimation:**
```
Photo upload: 100M/hari = ~1200 foto/detik
  Avg photo size: 3MB
  Storage/hari: 300 GB/hari → ~110 TB/tahun (belum termasuk thumbnail)

Feed request: 500M DAU × 5 request/hari = ~30.000 RPS
```

**High-Level Design:**
```
Mobile/Web → CDN (foto static)
           → API Gateway → Auth Service
                        → [Upload Service] → Object Store (S3)
                                          → [Media Processing] → Thumbnail Service
                                          → [Metadata DB]
                        → [Feed Service]  → [Feed Cache (Redis)]
                        → [Social Graph]  → [Graph DB / Adjacency List]
                        → [Notification]  → Push/Email/SMS
```

**Feed Generation — Critical Design:**

```
Opsi A: Pull Model (Fan-out on read)
  → User request feed → query DB semua following → merge & sort
  ✅ Storage efisien, fresh data
  ❌ Sangat lambat untuk user yang follow banyak (celebrity problem)

Opsi B: Push Model (Fan-out on write)
  → Post dibuat → tulis ke feed setiap follower
  ✅ Read sangat cepat (pre-computed)
  ❌ Mahal untuk celebrity (Justin Bieber: 100M followers = 100M write)

Opsi C: Hybrid
  → Normal user: fan-out on write (push)
  → Celebrity (> threshold): fan-out on read (pull)
  → Merge kedua hasil saat user request feed
  ✅ Balance antara write cost & read latency
  ❌ Kompleksitas lebih tinggi

🎯 Rekomendasi: Hybrid (C) untuk production Instagram-scale
```

**Database Design:**
```
User: PostgreSQL (ACID, relational)
Photos metadata: Cassandra (high write, scale)
Social graph: Redis adjacency list atau Graph DB
Feed: Redis sorted set (timestamp sebagai score)
Likes/Comments: Cassandra (high write throughput)
```

---

### Case 3: Design Real-Time Chat (WhatsApp)

**Requirements:**
- 1:1 dan group chat (max 1000 member)
- Delivery receipt (sent/delivered/read)
- 2B users, 100B messages/hari

**Capacity Estimation:**
```
Messages: 100B/hari = ~1.2M messages/detik
  Avg message: 100 bytes
  Storage/hari: 10 TB/hari

Connections: 2B users, 50% online = 1B concurrent connections
```

**High-Level Design:**
```
Client → [Load Balancer] → [Chat Servers] (WebSocket)
                               ↓
                        [Message Queue (Kafka)]
                               ↓
                  ┌────────────┴─────────────┐
            [Delivery Service]      [Storage Service]
                  ↓                       ↓
         [Notification Service]    [Cassandra (messages)]
                  ↓                [Redis (online status, sessions)]
         [APNS/FCM/WebPush]
```

**Key Decisions:**

*Protocol:*
```
WebSocket → Persistent bidirectional connection
  ✅ Real-time, full-duplex, low overhead
  Setiap chat server handle ~1M connections (dengan event loop: Go/Node.js)

Long Polling → Fallback untuk WebSocket tidak support
```

*Message Ordering:*
```
Problem: Di distributed system, order tidak terjamin
Solution:
  - Logical clock (Lamport timestamp)
  - Client-side sequence number per conversation
  - Server assign monotonic ID per conversation
```

*Group Chat:*
```
Fanout:
  < 100 member → Push ke semua member via queue
  > 100 member → Pull model: member query "messages since last seen"

🎯 Rekomendasi: 100 sebagai threshold
```

---

## Common Design Patterns Cheatsheet

### Rate Limiting
```
Token Bucket  → Burst allowed, refill rate = sustained rate
Leaky Bucket  → Smooth output, no burst
Fixed Window  → Simple, tapi edge case di boundary
Sliding Window→ Accurate, lebih mahal compute

Implementation: Redis + Lua script untuk atomicity
```

### Distributed ID Generation
```
UUID v4      → Random, 128-bit, no coordination needed
              ❌ Non-sequential, bad for DB index locality

Snowflake    → 64-bit: timestamp (41b) + datacenter (5b) + machine (5b) + seq (12b)
  ✅ Sequential, high throughput, distributed
  Tools: Twitter Snowflake, Sonyflake, ulid

Database auto-increment → Hanya untuk single DB, bottleneck di scale
```

### Search at Scale
```
Elasticsearch / OpenSearch:
  - Inverted index untuk full-text search
  - Shard untuk horizontal scale
  - Replica untuk high availability
  - Near real-time indexing (< 1 detik)

Pattern:
  DB (source of truth) → CDC (Debezium/Kafka) → Elasticsearch (search index)
```

### Geo-Distributed Systems
```
Multi-region Active-Active:
  - Data di-replicate ke semua region
  - Conflict resolution: last-write-wins atau CRDT
  - Routing: latency-based atau geo-based DNS

Multi-region Active-Passive:
  - Primary region handle semua write
  - Replica region handle read + failover
  - Simpler, tapi lebih tinggi latency untuk write dari jauh
```