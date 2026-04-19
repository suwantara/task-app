# Pola Desain Sistem — Referensi Cepat

## Pola Skalabilitas

### Load Balancing
- **Round Robin**: distribusi merata, sederhana
- **Least Connections**: arahkan ke server dengan koneksi paling sedikit
- **Consistent Hashing**: untuk stateful services / cache sharding
- **Weighted**: untuk server dengan kapasitas berbeda

### Caching Patterns
- **Cache-aside**: app cek cache → miss → baca DB → tulis cache
- **Write-through**: tulis ke cache & DB bersamaan
- **Write-behind**: tulis ke cache → async sync ke DB
- **Read-through**: cache otomatis load dari DB saat miss
- **Cache levels**: L1 (in-process) → L2 (Redis/Memcached) → L3 (CDN)

### Database Scaling
- **Read replicas**: pisahkan read dari write
- **Sharding**: partisi data horizontal (by user_id, region, dll.)
- **Federation**: pisahkan DB berdasarkan domain/fungsi
- **Denormalization**: duplikasi data untuk performa read

---

## Pola Keandalan (Reliability)

### Circuit Breaker
```
CLOSED → (error threshold tercapai) → OPEN → (timeout) → HALF-OPEN → (success) → CLOSED
```
- Gunakan: Resilience4j, Hystrix, Polly, Go-kit

### Retry dengan Exponential Backoff
```
Attempt 1: segera
Attempt 2: 1 detik
Attempt 3: 2 detik
Attempt 4: 4 detik + jitter
```

### Bulkhead
- Isolasi resource pool per service
- Mencegah cascade failure

### Saga Pattern (untuk distributed transactions)
- **Choreography**: setiap service publish event, tidak ada koordinator
- **Orchestration**: saga orchestrator mengirim perintah ke setiap service

---

## Pola Komunikasi

### Sinkron
- REST (HTTP/HTTPS)
- gRPC (Protocol Buffers, HTTP/2)
- GraphQL

### Asinkron
- Message Queue: RabbitMQ, Amazon SQS
- Event Streaming: Apache Kafka, Amazon Kinesis, Google Pub/Sub
- Webhook

### API Gateway Pattern
- Single entry point
- Cross-cutting concerns: auth, rate limiting, logging, routing

---

## Pola Data

### CQRS (Command Query Responsibility Segregation)
- Write model (Command): dioptimasi untuk tulis
- Read model (Query): dioptimasi untuk baca (denormalized)

### Event Sourcing
- State disimpan sebagai sequence of events
- State saat ini = replay semua events
- Cocok dengan CQRS untuk audit trail

### Outbox Pattern
- Simpan event ke tabel outbox dalam transaksi DB yang sama dengan data
- Worker terpisah kirim event ke message broker
- Menghindari dual-write problem

---

## Estimasi Kapasitas (Back-of-envelope)

### Angka yang perlu diingat
| Operasi | Latency |
|---------|---------|
| L1 cache | 1 ns |
| RAM access | 100 ns |
| SSD read | 100 µs |
| Network (same DC) | 500 µs |
| HDD read | 10 ms |
| Network (cross region) | 150 ms |

### Konversi storage
- 1 KB = 10³ bytes
- 1 MB = 10⁶ bytes
- 1 GB = 10⁹ bytes
- 1 TB = 10¹² bytes

### Estimasi cepat
- 1 juta req/hari ≈ 12 req/detik
- 1 miliar req/hari ≈ 12.000 req/detik