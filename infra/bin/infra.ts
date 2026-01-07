#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DocuMindStack } from '../lib/documind-stack';

const app = new cdk.App();

new DocuMindStack(app, 'DocuMindStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    description: 'DocuMind - AI Document Q&A Service Infrastructure',
});

app.synth();
