# DocuMind - AI Document Q&A Service

A demo MVP showcasing Java, TypeScript, AWS CDK, LangChain4j, Spring Boot, and React.

## 🚀 Live Demo

| Resource | URL |
|----------|-----|
| **Frontend** | [https://d3py6xai9gspab.cloudfront.net](https://d3py6xai9gspab.cloudfront.net) |
| **API** | [http://DocuMi-Backe-Mnku72pk6qQ2-534965933.us-east-1.elb.amazonaws.com](http://DocuMi-Backe-Mnku72pk6qQ2-534965933.us-east-1.elb.amazonaws.com) |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Spring Boot API │────▶│  LangChain4j    │
│  (TypeScript)   │     │  (Java 21)       │     │  + OpenAI/Local │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              ┌──────────┐         ┌──────────────┐
              │    S3    │         │  PostgreSQL  │
              │  (Docs)  │         │  (pgvector)  │
              └──────────┘         └──────────────┘
```

## Project Structure

```
├── backend/          # Spring Boot + LangChain4j API
├── frontend/         # React + TypeScript UI
└── infra/            # AWS CDK Infrastructure
```

## Local Development

Run everything locally using Docker for PostgreSQL.

### Prerequisites
- Java 21+
- Node.js 20+
- Docker

### 1. Start PostgreSQL (with pgvector)
```bash
cd backend
docker compose up -d
```

### 2. Configure Environment
Create `backend/.env`:
```
OPENAI_API_KEY=your-key-here
```

### 3. Start Backend
```bash
cd backend
mvn spring-boot:run
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Access the app at **http://localhost:5173**

---

## AWS Deployment (Optional)

Deploy to AWS using CDK. This creates production infrastructure:
- **VPC** with public/private subnets
- **RDS PostgreSQL** with pgvector
- **ECS Fargate** for the Spring Boot API
- **S3** for document storage
- **CloudFront** for frontend hosting

### Prerequisites
- AWS CLI configured (`aws configure`)
- AWS CDK installed (`npm install -g aws-cdk`)

### Deploy
```bash
cd infra
npm install
npx cdk bootstrap   # First time only
npx cdk deploy
```

### Post-Deploy
Update the OpenAI API key in AWS Secrets Manager:
```bash
aws secretsmanager put-secret-value \
  --secret-id documind/openai-api-key \
  --secret-string '{"apiKey":"sk-your-actual-key"}'
```

## Features
- PDF/Text document upload
- Automatic text extraction and chunking
- Vector embeddings with pgvector
- RAG-based Q&A with LangChain4j
- Conversation history
- Modern React UI
