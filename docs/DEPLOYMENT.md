# DocuMind Deployment & Teardown Guide

This guide covers deploying DocuMind to AWS and tearing down all resources.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deploy to AWS](#deploy-to-aws)
- [Post-Deployment Steps](#post-deployment-steps)
- [Teardown (Delete All Resources)](#teardown-delete-all-resources)
- [Cost Information](#cost-information)

---

## Prerequisites

Before deploying, ensure you have:

1. **AWS CLI** configured with credentials
   ```bash
   aws configure
   ```

2. **AWS CDK** installed globally
   ```bash
   npm install -g aws-cdk
   ```

3. **Docker** running (for building container images)

4. **Node.js 20+** and **Java 21+** installed

5. **OpenAI API Key** ready

---

## Deploy to AWS

### Step 1: Bootstrap CDK (First Time Only)

```bash
cd infra
npm install
npx cdk bootstrap
```

### Step 2: Deploy Infrastructure

```bash
cd infra
npx cdk deploy
```

This creates:
- VPC with public/private subnets
- ECS Fargate cluster with backend service
- RDS PostgreSQL database with pgvector
- S3 buckets (frontend assets + documents)
- CloudFront CDN
- Secrets Manager secrets
- Application Load Balancer

**Deployment takes ~15-20 minutes.**

### Step 3: Note the Outputs

After deployment, CDK outputs important values:

```
Outputs:
DocuMindStack.CloudFrontUrl = https://xxxxxx.cloudfront.net
DocuMindStack.ApiUrl = http://DocuMi-Backe-xxxxx.us-east-1.elb.amazonaws.com
DocuMindStack.FrontendBucketName = documind-frontend-xxxxx
DocuMindStack.DocumentsBucketName = documind-documents-xxxxx
DocuMindStack.DatabaseEndpoint = documindstack-xxxxx.rds.amazonaws.com
DocuMindStack.OpenAiSecretArn = arn:aws:secretsmanager:...
```

---

## Post-Deployment Steps

### Step 1: Configure OpenAI API Key

```bash
aws secretsmanager put-secret-value \
  --secret-id documind/openai-api-key \
  --secret-string '{"apiKey":"sk-your-actual-openai-key"}'
```

### Step 2: Restart ECS Service (to pick up the secret)

```bash
aws ecs update-service \
  --cluster documind-cluster \
  --service documind-api \
  --force-new-deployment
```

### Step 3: Build and Deploy Frontend

```bash
cd frontend
npm install
npm run build
```

Upload to S3 (replace with your bucket name from outputs):
```bash
aws s3 sync dist/ s3://documind-frontend-YOUR_ACCOUNT_ID-YOUR_REGION/ --delete
```

### Step 4: Invalidate CloudFront Cache

Get your CloudFront distribution ID:
```bash
aws cloudfront list-distributions --query "DistributionList.Items[*].{Id:Id,Domain:DomainName}" --output table
```

Invalidate cache:
```bash
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Step 5: Access Your Application

Open the CloudFront URL from the deployment outputs.

---

## Teardown (Delete All Resources)

**⚠️ WARNING: This will permanently delete all data including uploaded documents and database content.**

### Step 1: Verify Resources to Delete

```bash
cd infra
npx cdk diff
```

### Step 2: Destroy All Resources

```bash
cd infra
npx cdk destroy
```

Type `y` when prompted to confirm deletion.

**Destruction takes ~10-15 minutes.**

### Step 3: Verify Cleanup

Check that resources are deleted:

```bash
# Check S3 buckets
aws s3 ls | grep documind

# Check ECS clusters
aws ecs list-clusters | grep documind

# Check RDS instances
aws rds describe-db-instances --query "DBInstances[*].DBInstanceIdentifier" | grep documind

# Check CloudFront distributions
aws cloudfront list-distributions --query "DistributionList.Items[*].DomainName"

# Check Secrets Manager
aws secretsmanager list-secrets --query "SecretList[*].Name" | grep documind
```

### Step 4: Manual Cleanup (If Needed)

If any resources remain:

**Delete S3 buckets:**
```bash
aws s3 rb s3://documind-frontend-ACCOUNT-REGION --force
aws s3 rb s3://documind-documents-ACCOUNT-REGION --force
```

**Delete Secrets:**
```bash
aws secretsmanager delete-secret --secret-id documind/openai-api-key --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id documind/db-credentials --force-delete-without-recovery
```

**Delete CloudWatch Log Groups:**
```bash
aws logs delete-log-group --log-group-name /ecs/documind-api
```

### Step 5: Clean CDK Bootstrap (Optional)

If you don't plan to use CDK again in this account/region:
```bash
# Delete the CDKToolkit CloudFormation stack
aws cloudformation delete-stack --stack-name CDKToolkit
```

---

## Cost Information

### Monthly Costs (Approximate)

| Service | Configuration | Cost |
|---------|---------------|------|
| ECS Fargate | 0.5 vCPU, 1GB RAM | ~$15-20 |
| RDS PostgreSQL | db.t3.micro, 20GB | ~$15-20 |
| NAT Gateway | Data processing | ~$30-40 |
| ALB | Basic usage | ~$20 |
| CloudFront | Low traffic | ~$1-5 |
| S3 | Minimal storage | ~$1-2 |
| Secrets Manager | 2 secrets | ~$1 |
| **Total** | | **~$85-115/month** |

### Cost Optimization Tips

1. **NAT Gateway** is the biggest cost - consider VPC endpoints for production
2. **Stop ECS service** when not in use: `aws ecs update-service --cluster documind-cluster --service documind-api --desired-count 0`
3. **Use Fargate Spot** for non-production workloads

---

## Redeployment Checklist

When redeploying in the future:

- [ ] AWS CLI configured (`aws configure`)
- [ ] Docker running
- [ ] CDK installed (`npm install -g aws-cdk`)
- [ ] Run `cd infra && npm install`
- [ ] Run `npx cdk bootstrap` (if new account/region)
- [ ] Run `npx cdk deploy`
- [ ] Configure OpenAI API key in Secrets Manager
- [ ] Restart ECS service
- [ ] Build and deploy frontend to S3
- [ ] Invalidate CloudFront cache
- [ ] Test application

---

## Files Required for Redeployment

All infrastructure is captured in code:

```
infra/
├── bin/infra.ts          # CDK app entry point
├── lib/documind-stack.ts # All AWS resources defined here
├── package.json          # CDK dependencies
├── tsconfig.json         # TypeScript config
└── cdk.json              # CDK config

backend/
├── Dockerfile            # Container build instructions
├── pom.xml               # Java dependencies
└── src/                  # Application code

frontend/
├── package.json          # Frontend dependencies
└── src/                  # React application
```

No manual AWS console configuration is required - everything is Infrastructure as Code.
