# DocuMind Architecture Documentation

## Table of Contents

- [Introduction](#introduction)
- [The Problem & Solution](#the-problem--solution)
- [Java & Spring Boot](#java--spring-boot)
- [RAG Pipeline Deep Dive](#rag-pipeline-deep-dive)
- [Tech Decisions](#tech-decisions)
- [Database Schema](#database-schema)
- [AWS Infrastructure](#aws-infrastructure)
- [Security Model](#security-model)
- [Cost Analysis](#cost-analysis)
- [Performance Considerations](#performance-considerations)
- [Future Improvements](#future-improvements)

---

## Introduction

DocuMind is an AI-powered document Q&A service that demonstrates how modern NLP and RAG (Retrieval-Augmented Generation) technologies can transform how teams interact with their knowledge bases.

This documentation provides a deep dive into the architecture, design decisions, and infrastructure that power DocuMind.

---

## The Problem & Solution

### The Traditional Approach

Before AI-powered document search, teams faced significant challenges:

| Challenge | Traditional Solution | Limitations |
|-----------|---------------------|-------------|
| Finding information | Keyword search (Ctrl+F, grep) | Requires exact matches, misses semantic meaning |
| Understanding documents | Manual reading | Time-consuming, doesn't scale |
| Cross-document insights | Human synthesis | Requires domain expertise, prone to oversight |
| Onboarding new members | Documentation wikis | Often outdated, hard to navigate |
| Customer support | FAQ databases | Limited coverage, rigid responses |

**Example:** A developer searching for "how to deploy" might miss documentation titled "production release process" because the keywords don't match—even though the content is exactly what they need.

### How RAG Changes Everything

**Retrieval-Augmented Generation (RAG)** combines the best of two worlds:

1. **Retrieval**: Find relevant information using semantic similarity (understanding meaning, not just keywords)
2. **Generation**: Use LLMs to synthesize answers from retrieved context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEFORE: Keyword Search                            │
│                                                                             │
│   Query: "deployment steps"                                                 │
│      ↓                                                                      │
│   Search: CTRL+F "deployment"                                               │
│      ↓                                                                      │
│   Result: 47 matches across 12 documents                                    │
│      ↓                                                                      │
│   User: Manually reads each match to find relevant info                     │
│      ↓                                                                      │
│   Time: 30+ minutes                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            AFTER: RAG-Powered Q&A                           │
│                                                                             │
│   Query: "How do I deploy to production?"                                   │
│      ↓                                                                      │
│   Semantic Search: Finds conceptually similar content                       │
│      ↓                                                                      │
│   Retrieved: Top 5 relevant chunks from documentation                       │
│      ↓                                                                      │
│   LLM: Synthesizes clear, cited answer                                      │
│      ↓                                                                      │
│   Time: 3 seconds                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Impact on Teams

| Use Case | Before RAG | With RAG |
|----------|------------|----------|
| **Developer Onboarding** | Weeks reading docs | Ask questions, get instant answers |
| **Research Analysis** | Days synthesizing papers | Query across all papers instantly |
| **Customer Support** | Search knowledge base manually | AI suggests answers with sources |
| **Legal/Compliance** | Paralegals search documents | Instant policy lookups with citations |
| **Internal Knowledge** | "Ask Bob, he knows" | Query the entire company knowledge |

---

## Java & Spring Boot

### Why Java for AI Applications?

While Python dominates the AI/ML landscape, Java offers compelling advantages for production AI applications:

| Aspect | Java Advantage |
|--------|----------------|
| **Performance** | JVM optimizations, GraalVM native compilation potential |
| **Enterprise Integration** | Seamless integration with existing enterprise systems |
| **Type Safety** | Compile-time error detection, better refactoring |
| **Concurrency** | Mature threading model, virtual threads (Java 21) |
| **Ecosystem** | Spring Boot, mature dependency management, monitoring |
| **Talent Pool** | Large pool of enterprise Java developers |

### Spring Boot Benefits

DocuMind leverages Spring Boot 3.2 for:

- **Dependency Injection**: Clean separation of concerns
- **Auto-configuration**: Minimal boilerplate for database, web, etc.
- **Actuator**: Built-in health checks and metrics
- **Profile Management**: Easy switching between local and production configs
- **Async Processing**: `@Async` for non-blocking document processing

### Java 21 Features Used

- **Virtual Threads**: Improved concurrency for I/O-bound operations
- **Record Classes**: Immutable DTOs with minimal code
- **Pattern Matching**: Cleaner type checking and casting
- **Text Blocks**: Multi-line strings for prompts and SQL

---

## RAG Pipeline Deep Dive

### Document Ingestion Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DOCUMENT INGESTION                                     │
│                                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │  Upload  │───▶│  Parse PDF/  │───▶│   Chunk      │───▶│  Generate Embeddings  │  │
│  │  Document│    │  Text Files  │    │   (1500 char)│    │  (AllMiniLmL6V2)      │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                                      │              │
│                                                                      ▼              │
│                                                          ┌───────────────────────┐  │
│                                                          │  Store in pgvector    │  │
│                                                          │  (PostgreSQL)         │  │
│                                                          └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Breakdown

#### 1. Document Upload
- User uploads PDF or text file via React frontend
- File sent to Spring Boot API as multipart form data
- Document metadata stored in PostgreSQL

#### 2. Text Extraction
- **PDF**: Apache PDFBox extracts text content
- **Text**: Direct content reading
- Content normalized and cleaned

#### 3. Chunking Strategy
```
Document: "The quick brown fox jumps over the lazy dog. The dog was sleeping..."
                                    ↓
                        Recursive Text Splitter
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ Chunk 1 (1500 chars max)                                                │
│ "The quick brown fox jumps over the lazy dog. The dog was sleeping..."  │
├─────────────────────────────────────────────────────────────────────────┤
│ Chunk 2 (with 200 char overlap)                                         │
│ "...The dog was sleeping peacefully in the sun. Meanwhile, the fox..."  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why 1500 characters with 200 overlap?**
- **1500 chars**: Enough context for meaningful retrieval without exceeding embedding model limits
- **200 overlap**: Ensures context isn't lost at chunk boundaries

#### 4. Embedding Generation
- Each chunk converted to 384-dimensional vector using AllMiniLmL6V2
- Embeddings capture semantic meaning, not just keywords
- Runs locally (no API calls), fast and cost-effective

#### 5. Vector Storage
- Embeddings stored in PostgreSQL with pgvector extension
- Indexed for efficient similarity search
- Metadata (document ID, filename) stored alongside

### Question Answering Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              QUESTION ANSWERING                                     │
│                                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │  User    │───▶│  Embed       │───▶│  Vector      │───▶│  Retrieve Top 5       │  │
│  │  Question│    │  Question    │    │  Similarity  │    │  Relevant Chunks      │  │
│  └──────────┘    └──────────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                                      │              │
│                                                                      ▼              │
│  ┌──────────┐    ┌──────────────────────────────────────────────────────────────┐   │
│  │  Answer  │◀───│  OpenAI GPT-4o-mini generates answer with context + sources  │   │
│  └──────────┘    └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Prompt Engineering

The system prompt instructs the LLM how to behave:

```
You are a helpful assistant that answers questions based on the provided context.
Use ONLY the information from the context to answer. If the answer is not in the
context, say "I don't have enough information to answer that question."

Always cite your sources by mentioning which document the information came from.
```

**Context Injection Format:**
```
Context:
---
[Source: document1.pdf]
<chunk content here>
---
[Source: document2.txt]
<chunk content here>
---

Question: <user's question>
```

---

## Tech Decisions

### LangChain4j vs Python LangChain

| Criteria | LangChain4j (Java) | LangChain (Python) |
|----------|-------------------|-------------------|
| **Enterprise Integration** | Native Spring Boot support | Requires bridging |
| **Type Safety** | Compile-time checks | Runtime errors |
| **Performance** | JVM optimizations | GIL limitations |
| **Deployment** | Single JAR, Docker | Python environment complexity |
| **Team Skills** | Leverages existing Java talent | Requires Python expertise |
| **Maturity** | Newer, growing rapidly | More mature, larger community |

**Decision**: LangChain4j chosen for seamless Spring Boot integration and enterprise deployment patterns.

### pgvector vs Dedicated Vector Databases

| Criteria | pgvector | Pinecone/Weaviate |
|----------|----------|-------------------|
| **Cost** | Free (PostgreSQL extension) | $70+/month |
| **Ops Complexity** | Single database to manage | Additional service |
| **Transactions** | Full ACID with relational data | Separate from main DB |
| **Scale** | Millions of vectors | Billions of vectors |
| **Latency** | ~10-50ms | ~5-20ms |

**Decision**: pgvector chosen for cost-effectiveness and operational simplicity. Single PostgreSQL instance handles both relational data and vector search.

### Local Embeddings vs Cloud API

| Criteria | Local (AllMiniLmL6V2) | Cloud (OpenAI) |
|----------|----------------------|----------------|
| **Latency** | ~10ms | ~100-500ms |
| **Cost** | Free | $0.0001/1K tokens |
| **Privacy** | Data stays local | Data sent to API |
| **Quality** | Good for English text | Slightly better |
| **Offline** | Works offline | Requires internet |

**Decision**: Local embeddings for speed and cost. OpenAI used only for final answer generation where quality matters most.

### Why OpenAI GPT-4o-mini for Generation

- **Cost-effective**: $0.15/1M input tokens (vs $2.50 for GPT-4)
- **Fast**: Low latency responses
- **Quality**: Sufficient for Q&A with provided context
- **Reliability**: High uptime, well-documented API

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────┐     ┌─────────────────────────────────────┐
│       documents         │     │        document_embeddings          │
├─────────────────────────┤     │           (pgvector)                │
│ id (UUID, PK)           │     ├─────────────────────────────────────┤
│ filename (VARCHAR)      │     │ id (UUID, PK)                       │
│ content_type (VARCHAR)  │     │ embedding (VECTOR(384))             │
│ file_size (BIGINT)      │     │ text (TEXT)                         │
│ chunk_count (INT)       │     │ metadata (JSONB)                    │
│ status (ENUM)           │◄────│   - documentId                      │
│ error_message (TEXT)    │     │   - filename                        │
│ created_at (TIMESTAMP)  │     └─────────────────────────────────────┘
│ processed_at (TIMESTAMP)│
└─────────────────────────┘
            │
            │
            ▼
┌─────────────────────────┐
│     chat_messages       │
├─────────────────────────┤
│ id (BIGINT, PK)         │
│ session_id (VARCHAR)    │
│ role (ENUM)             │
│ content (TEXT)          │
│ created_at (TIMESTAMP)  │
└─────────────────────────┘
```

### Table Details

#### `documents`
Stores metadata about uploaded documents.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `filename` | VARCHAR | Original filename |
| `content_type` | VARCHAR | MIME type (application/pdf, text/plain) |
| `file_size` | BIGINT | Size in bytes |
| `chunk_count` | INT | Number of chunks created |
| `status` | ENUM | PENDING, PROCESSING, COMPLETED, FAILED |
| `error_message` | TEXT | Error details if failed |
| `created_at` | TIMESTAMP | Upload timestamp |
| `processed_at` | TIMESTAMP | Processing completion timestamp |

#### `document_embeddings` (pgvector)
Stores vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `embedding` | VECTOR(384) | 384-dimensional embedding vector |
| `text` | TEXT | Original chunk text |
| `metadata` | JSONB | Document ID, filename, etc. |

#### `chat_messages`
Stores conversation history for context.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `session_id` | VARCHAR | Groups messages by session |
| `role` | ENUM | USER or ASSISTANT |
| `content` | TEXT | Message content |
| `created_at` | TIMESTAMP | Message timestamp |

---

## AWS Infrastructure

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    USERS                                            │
└─────────────────────────────────────┬───────────────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFRONT CDN                                         │
│                    https://d3py6xai9gspab.cloudfront.net                            │
│                                                                                     │
│  ┌─────────────────┐                              ┌─────────────────┐               │
│  │   Static Assets │◄─────────────────────────────┤   API Routes    │               │
│  │   (/, /*, etc.) │                              │   (/api/*)      │               │
│  └─────────────────┘                              └─────────────────┘               │
└─────────────┬───────────────────────────────────────────────┬───────────────────────┘
              │                                               │
              ▼                                               ▼
┌─────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│            S3 BUCKET                │    │        APPLICATION LOAD BALANCER        │
│   documind-frontend-884710187119    │    │              (Port 80)                  │
│         (Frontend Assets)           │    └─────────────┬───────────────────────────┘
└─────────────────────────────────────┘                  │ HTTP
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    VPC                                              │
│                          (us-east-1a & us-east-1b)                                  │
│                                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           PUBLIC SUBNETS                                    │    │
│  │  ┌─────────────────┐                    ┌─────────────────┐                 │    │
│  │  │ Internet Gateway│                    │   NAT Gateway   │                 │    │
│  │  └─────────────────┘                    └─────────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │ Outbound Internet                       │
│                                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          PRIVATE SUBNETS                                    │    │
│  │                                                                             │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                    ECS FARGATE CLUSTER                              │    │    │
│  │  │                                                                     │    │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │    │
│  │  │  │ ECS Task    │  │ ECS Task    │  │ ECS Task    │                  │    │    │
│  │  │  │documind-api │  │documind-api │  │documind-api │                  │    │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │    │
│  │  │              Auto Scaling: 50% - 200% capacity                      │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  │                                           │ Database Connection             │    │
│  │                                           ▼                                 │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │                    RDS POSTGRESQL                                   │    │    │
│  │  │  Instance: db.t3.micro | Storage: 20GB (auto-scale to 100GB)        │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                           │ Document Storage
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  S3 DOCUMENTS BUCKET: documind-documents-884710187119 (Encrypted, CORS enabled)     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Layer

#### CloudFront Distribution
**URL**: https://d3py6xai9gspab.cloudfront.net

| Feature | Configuration |
|---------|---------------|
| Global CDN | Low-latency content delivery worldwide |
| HTTPS | Redirect HTTP to HTTPS |
| SPA Routing | Custom error handling returns index.html for 404s |
| API Proxy | Routes `/api/*` to backend load balancer |
| Caching | Optimized caching for static assets |

#### S3 Frontend Bucket
**Name**: `documind-frontend-884710187119-us-east-1`

- Stores static frontend assets (HTML, CSS, JavaScript)
- Private bucket with CloudFront Origin Access Identity
- Integrated with CloudFront for secure content delivery

### Application Layer

#### ECS Fargate Cluster
**Cluster**: `documind-cluster`

| Configuration | Value |
|---------------|-------|
| Service | `documind-api` |
| Launch Type | Fargate (serverless containers) |
| CPU | 512 units (0.5 vCPU) |
| Memory | 1024 MB |
| Min Capacity | 50% |
| Max Capacity | 200% |
| Subnets | Private (no public IP) |

#### Application Load Balancer
**DNS**: `DocuMi-Backe-Mnku72pk6qQ2-534965933.us-east-1.elb.amazonaws.com`

- Distributes traffic across ECS tasks
- Health checks on `/health` endpoint
- Automatic failover to healthy tasks

### Data Layer

#### RDS PostgreSQL Database
**Endpoint**: `documindstack-databaseb269d8bb-j3atgamvxozk.cq9g08y02y5x.us-east-1.rds.amazonaws.com`

| Configuration | Value |
|---------------|-------|
| Engine | PostgreSQL 15 |
| Instance | db.t3.micro |
| Storage | 20GB (auto-scales to 100GB) |
| Database Name | documind |
| Extensions | pgvector |
| Subnets | Private (no public access) |
| Backup | Automated daily backups |

#### S3 Documents Bucket
**Name**: `documind-documents-884710187119-us-east-1`

| Feature | Configuration |
|---------|---------------|
| Encryption | Server-side encryption (AES-256) |
| CORS | Enabled for web application access |
| Versioning | Disabled (can be enabled for audit) |
| Lifecycle | No automatic deletion |

### Network Architecture

| Component | Availability Zones | Purpose |
|-----------|-------------------|---------|
| VPC | us-east-1a, us-east-1b | Isolated network |
| Public Subnets | Both AZs | ALB, NAT Gateway, Internet Gateway |
| Private Subnets | Both AZs | ECS tasks, RDS database |
| Internet Gateway | N/A | Inbound internet access to public subnets |
| NAT Gateway | us-east-1a | Outbound internet for private subnets |

### Architecture Flow

1. **User Access**: Users access the application via CloudFront CDN (HTTPS)
2. **Content Delivery**: Static assets from S3, API calls to ALB
3. **Application Processing**: ALB distributes to ECS Fargate tasks
4. **Data Storage**: PostgreSQL for data, S3 for documents
5. **AI Integration**: ECS tasks call OpenAI API (via NAT Gateway)

---

## Security Model

### Network Security

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ALB SECURITY GROUP                           │
│                  Inbound: 0.0.0.0/0:80                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ECS SECURITY GROUP                           │
│                  Inbound: ALB SG:8080                           │
│                  Outbound: 0.0.0.0/0 (via NAT)                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RDS SECURITY GROUP                           │
│                  Inbound: ECS SG:5432                           │
│                  Outbound: None required                        │
└─────────────────────────────────────────────────────────────────┘
```

### Security Components

| Component | Security Feature |
|-----------|-----------------|
| **VPC** | Isolated network, private subnets for sensitive resources |
| **ALB** | Only accepts HTTP traffic on port 80 |
| **ECS Tasks** | Run in private subnets, no public IP |
| **RDS** | Private subnets, security group restricts to ECS only |
| **S3 Buckets** | Private, accessed via IAM roles or CloudFront OAI |

### Secrets Management

AWS Secrets Manager securely stores:

| Secret | Purpose |
|--------|---------|
| `documind/database-credentials` | RDS username and password |
| `documind/openai-api-key` | OpenAI API key for GPT-4o-mini |

**Access Pattern**:
- ECS task role has permission to read secrets
- Secrets injected as environment variables at container startup
- Never stored in code or config files

### IAM Roles

| Role | Purpose | Permissions |
|------|---------|-------------|
| ECS Task Execution Role | Pull images, write logs | ECR read, CloudWatch Logs write |
| ECS Task Role | Application permissions | Secrets Manager read, S3 access |

---

## Cost Analysis

### Estimated Monthly Costs (us-east-1)

| Service | Configuration | Estimated Cost |
|---------|---------------|----------------|
| **ECS Fargate** | 0.5 vCPU, 1GB RAM, 24/7 | ~$15-20/month |
| **RDS PostgreSQL** | db.t3.micro, 20GB | ~$15-20/month |
| **NAT Gateway** | Data processing | ~$30-40/month |
| **Application Load Balancer** | Basic usage | ~$20/month |
| **CloudFront** | Low traffic | ~$1-5/month |
| **S3** | Minimal storage | ~$1-2/month |
| **Secrets Manager** | 2 secrets | ~$1/month |
| **OpenAI API** | ~1000 queries/month | ~$1-5/month |
| **Total** | | **~$85-115/month** |

### Cost Optimization Options

| Optimization | Savings | Trade-off |
|--------------|---------|-----------|
| Remove NAT Gateway | ~$30/month | Requires VPC endpoints or public subnets |
| Use Fargate Spot | ~50% on Fargate | Possible interruptions |
| Reserved RDS | ~30% on RDS | 1-year commitment |
| Reduce ECS to 0.25 vCPU | ~$7/month | Slower processing |

---

## Performance Considerations

### Why Local Embeddings?

| Metric | Local (AllMiniLmL6V2) | Cloud (OpenAI) |
|--------|----------------------|----------------|
| Latency per embed | ~10ms | ~100-500ms |
| Batch of 10 chunks | ~50ms | ~500-2000ms |
| Cost per 1M tokens | $0 | $0.10 |
| Cold start | None | None |

**Result**: Document processing is 10x faster and free.

### Vector Search Performance

pgvector with IVFFlat index:
- **Index type**: IVFFlat (approximate nearest neighbor)
- **Query time**: ~10-50ms for top-5 retrieval
- **Scale**: Handles millions of vectors efficiently

### Response Time Breakdown

| Step | Time |
|------|------|
| Embed question | ~10ms |
| Vector search | ~20ms |
| Context retrieval | ~10ms |
| OpenAI API call | ~500-1500ms |
| **Total** | **~550-1600ms** |

The OpenAI API call dominates response time. Future optimization: streaming responses.

---

## Future Improvements

### Potential Enhancements

| Feature | Description | Complexity |
|---------|-------------|------------|
| **PDF OCR** | Extract text from scanned PDFs | Medium |
| **Multi-modal** | Support images, tables in documents | High |
| **Streaming Responses** | Real-time token streaming | Medium |
| **Document Versioning** | Track document changes over time | Low |
| **User Authentication** | Multi-tenant with user accounts | Medium |
| **Fine-tuned Embeddings** | Domain-specific embedding model | High |
| **Hybrid Search** | Combine keyword + semantic search | Medium |
| **Response Caching** | Cache frequent questions | Low |
| **Analytics Dashboard** | Usage metrics, popular queries | Medium |

### Scaling Considerations

| Scale | Current | Future |
|-------|---------|--------|
| Documents | ~100s | 10,000+ → Consider S3 storage for content |
| Vectors | ~10,000 | 1M+ → Consider Pinecone or pgvector optimization |
| Users | Single tenant | Multi-tenant → Add authentication layer |
| Queries | ~100/day | 10,000+/day → Add Redis caching |

---

## Conclusion

DocuMind demonstrates that production-ready AI applications can be built with:

- **Java & Spring Boot** for enterprise-grade backend
- **LangChain4j** for AI/LLM integration
- **pgvector** for cost-effective vector search
- **AWS CDK** for infrastructure as code
- **Local embeddings + Cloud LLM** for optimal cost/quality balance

The architecture follows AWS Well-Architected Framework principles:
- **Operational Excellence**: Infrastructure as code, health checks
- **Security**: Private subnets, secrets management, IAM roles
- **Reliability**: Multi-AZ, auto-scaling, health checks
- **Performance**: CDN, local embeddings, efficient vector search
- **Cost Optimization**: Right-sized instances, local embeddings

This provides a solid foundation for teams looking to build similar AI-powered document applications.
