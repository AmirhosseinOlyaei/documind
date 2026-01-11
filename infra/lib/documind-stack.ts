import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export class DocuMindStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // VPC
        const vpc = new ec2.Vpc(this, 'DocuMindVpc', {
            maxAzs: 2,
            natGateways: 1,
        });

        // S3 Bucket for documents
        const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
            bucketName: `documind-documents-${this.account}-${this.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
        });

        // S3 Bucket for frontend hosting
        const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `documind-frontend-${this.account}-${this.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });

        // Secrets for OpenAI API Key
        const openAiSecret = new secretsmanager.Secret(this, 'OpenAiApiKey', {
            secretName: 'documind/openai-api-key',
            description: 'OpenAI API Key for DocuMind',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ apiKey: 'REPLACE_ME' }),
                generateStringKey: 'dummy',
            },
        });

        // RDS PostgreSQL with pgvector
        const dbCredentials = new secretsmanager.Secret(this, 'DbCredentials', {
            secretName: 'documind/db-credentials',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'documind' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                includeSpace: false,
            },
        });

        const database = new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16,
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            databaseName: 'documind',
            credentials: rds.Credentials.fromSecret(dbCredentials),
            multiAz: false,
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            deletionProtection: false,
        });

        // ECS Cluster
        const cluster = new ecs.Cluster(this, 'DocuMindCluster', {
            vpc,
            clusterName: 'documind-cluster',
        });

        // Fargate Service with ALB
        const backendService = new ecs_patterns.ApplicationLoadBalancedFargateService(
            this,
            'BackendService',
            {
                cluster,
                serviceName: 'documind-api',
                cpu: 512,
                memoryLimitMiB: 1024,
                desiredCount: 1,
                taskImageOptions: {
                    image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../../backend'), {
                        file: 'Dockerfile',
                    }),
                    containerPort: 8080,
                    environment: {
                        DB_HOST: database.instanceEndpoint.hostname,
                        DB_PORT: database.instanceEndpoint.port.toString(),
                        DB_NAME: 'documind',
                        SPRING_PROFILES_ACTIVE: 'prod',
                        APP_CORS_ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000,https://*.cloudfront.net',
                    },
                    secrets: {
                        DB_USERNAME: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
                        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
                        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(openAiSecret, 'apiKey'),
                    },
                },
                publicLoadBalancer: true,
                healthCheckGracePeriod: cdk.Duration.seconds(120),
            }
        );

        // Allow Fargate to connect to RDS
        database.connections.allowFrom(
            backendService.service,
            ec2.Port.tcp(5432),
            'Allow from Fargate service'
        );

        // Grant S3 access to the backend
        documentsBucket.grantReadWrite(backendService.taskDefinition.taskRole);

        // Configure health check
        backendService.targetGroup.configureHealthCheck({
            path: '/health',
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3,
            interval: cdk.Duration.seconds(30),
            timeout: cdk.Duration.seconds(10),
        });

        // CloudFront Distribution
        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(frontendBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            additionalBehaviors: {
                '/api/*': {
                    origin: new origins.LoadBalancerV2Origin(backendService.loadBalancer, {
                        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
                    }),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
                },
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        });

        // Outputs
        new cdk.CfnOutput(this, 'CloudFrontUrl', {
            value: `https://${distribution.distributionDomainName}`,
            description: 'CloudFront Distribution URL',
        });

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: `http://${backendService.loadBalancer.loadBalancerDnsName}`,
            description: 'Backend API URL',
        });

        new cdk.CfnOutput(this, 'DocumentsBucketName', {
            value: documentsBucket.bucketName,
            description: 'S3 Bucket for documents',
        });

        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: frontendBucket.bucketName,
            description: 'S3 Bucket for frontend assets',
        });

        new cdk.CfnOutput(this, 'DatabaseEndpoint', {
            value: database.instanceEndpoint.hostname,
            description: 'RDS PostgreSQL endpoint',
        });

        new cdk.CfnOutput(this, 'OpenAiSecretArn', {
            value: openAiSecret.secretArn,
            description: 'Update this secret with your OpenAI API key',
        });
    }
}
