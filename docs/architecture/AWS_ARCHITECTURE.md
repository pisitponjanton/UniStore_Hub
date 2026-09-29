# UniStore Hub — AWS Architecture Reference

> **Source:** Final System & Deployment Specification + attached "UniStore Hub — AWS System Architecture" diagram  
> **Target:** AWS Academy Learner Lab  
> **Region:** `us-east-1`  
> **Status:** FINAL architecture reference

---

## 1. Purpose

เอกสารนี้เป็น textual reference ของ AWS architecture ที่ Agent ทุกตัวใช้ร่วมกัน

หน้าที่ของเอกสารนี้คือ:

- ล็อก AWS services ที่ใช้จริงใน Learner Lab baseline
- อธิบาย flow หมายเลข 1–19 จาก architecture diagram
- แยก Frontend, Backend API, Auth, Business Logic, Storage, Notification, Monitoring และ Cost Control ให้ชัด
- ป้องกัน architecture drift ระหว่าง Frontend / Backend / Infrastructure agents
- ระบุข้อจำกัดที่เป็น Lab Demo โดยไม่เปลี่ยนเป็น production architecture ใหม่เอง

เอกสารนี้ **ไม่ใช่** API endpoint spec และ **ไม่ใช่** CloudFormation implementation spec

---

## 2. Architecture Overview

```text
User / Customer / Staff / Admin
│
├── HTTP
│    ↓
│   Amazon S3
│   Next.js Static Export / Static Website
│
└── HTTPS API Request + JWT
     ↓
Amazon API Gateway
     ↓
AWS Lambda
Express.js
Application Authentication + Business Logic
     │
     ├── Amazon DynamoDB
     │   Application Data
     │
     ├── Generate Pre-signed URL
     │          ↓
     │      Browser ↔ Amazon S3 Files
     │
     └── Amazon SQS
          ↓
       AWS Lambda Worker
          ↓
       Amazon DynamoDB
       In-app Notification

API Gateway / Backend Lambda / SQS / Worker Lambda
          ↓
     Amazon CloudWatch

Overall AWS Resources
          ↓
AWS Cost Explorer / Learner Lab Budget
```

---

## 3. Architecture Zones

### 3.1 Frontend

```text
Next.js + TypeScript
→ output: "export"
→ Amazon S3 Static Website
```

**FINAL**

- S3 hosts generated static files.
- Lab Demo static website access is HTTP as shown in the architecture diagram.
- Backend APIs remain HTTPS.

### 3.2 Backend API

```text
Browser
→ HTTPS
→ Amazon API Gateway
→ Backend Lambda
→ Express.js
```

Responsibilities:

- REST API entry point
- Authentication
- JWT generation / verification
- RBAC / permission checks
- Organization membership checks
- Business logic
- Application data access
- Pre-signed URL generation
- Notification event publishing

### 3.3 Application Authentication

Authentication is **inside Backend Lambda**.

```text
Express.js + JWT
├── Register
├── Login
├── Password Verification
├── JWT Generation
├── JWT Verification
├── RBAC / Permission
└── Organization Membership
```

**FINAL**

This is not a separate AWS authentication service.

Learner Lab baseline does not use Cognito.

### 3.4 Business Data

```text
Backend Lambda
↔ Amazon DynamoDB
```

DynamoDB stores application data including:

- Users / Auth
- Organizations
- Organization Members
- Stores
- Products / Variants
- Campaigns
- Orders / Order Items
- Payments
- Pickups
- Audit Logs
- In-app Notifications

### 3.5 Data & File Storage

```text
Amazon S3 Files
├── Product Images
└── Payment Slips
```

Payment Slips are private.

Backend generates Pre-signed URLs and the Browser uploads/downloads directly to/from the Files bucket.

### 3.6 Notification

```text
Business Lambda
→ Amazon SQS
→ Lambda Worker
→ DynamoDB
```

Notification events defined by the source:

- Payment Approved
- Payment Rejected
- Ready for Pickup

### 3.7 Monitoring & Logging

```text
API Gateway ───────┐
Backend Lambda ────┤
SQS ───────────────┼→ Amazon CloudWatch
Worker Lambda ─────┘
```

CloudWatch is the baseline logging / metrics service.

### 3.8 Cost Control

```text
Overall AWS Usage
→ AWS Cost Explorer
→ Learner Lab Budget
```

### 3.9 IAM

Runtime permissions use:

```text
pre-created LabRole
```

Do not create IAM Users / Groups for this baseline.

Do not introduce a custom Lambda execution role unless the Final Learner Lab baseline is explicitly changed.

---

## 4. Diagram Flow 1–19

The following mapping mirrors the attached architecture diagram.

### Flow 1 — HTTP Request for Static Files

```text
User / Browser
→ HTTP Request
→ Amazon S3 Frontend Website
```

Purpose:

- Request generated Next.js static files.

Typical content:

- HTML
- CSS
- JavaScript

### Flow 2 — Static Files Response

```text
Amazon S3
→ Static Files Response
→ User / Browser
```

S3 returns the exported frontend assets.

### Flow 3 — HTTPS API Request

```text
User / Browser
→ HTTPS
→ Amazon API Gateway
```

Request categories shown in the diagram:

- Register
- Login
- Business API requests
- JWT-authenticated requests

### Flow 4 — Invoke Backend Lambda

```text
Amazon API Gateway
→ HTTP Event
→ Backend Lambda
```

Backend Lambda runs Express.js authentication and business logic.

### Flow 5 — Read / Write Application Data

```text
Backend Lambda
→ Read / Write
→ Amazon DynamoDB
```

DynamoDB is the application database.

### Flow 6 — Data Response

```text
Amazon DynamoDB
→ Data Response
→ Backend Lambda
```

Backend uses returned data for authentication, authorization and business operations.

### Flow 7 — API Response

```text
Backend Lambda
→ Amazon API Gateway
→ User / Browser
```

Response is application data such as JSON and, for authentication flows, JWT-related response data.

### Flow 8 — HTTPS Request for Pre-signed URL

```text
User / Browser
→ HTTPS API Request
→ Amazon API Gateway
```

Purpose:

- Request authorized Upload / Download URL for file operations.

### Flow 9 — Request URL Generation

```text
Amazon API Gateway
→ HTTP Event
→ Backend Lambda
```

Backend validates access and generates an S3 Pre-signed URL.

### Flow 10 — Pre-signed URL Response

```text
Backend Lambda
→ Amazon API Gateway
→ User / Browser
```

Response contains an authorized URL for Upload / Download.

### Flow 11 — Direct Upload / Download

```text
User / Browser
↔ Amazon S3 Files
```

The Browser transfers the file directly using the Pre-signed URL.

**FINAL**

Backend does not proxy the binary file through API Gateway.

### Flow 12 — Send Notification Event

```text
Business Lambda
→ Amazon SQS
```

Events shown in the diagram:

- Payment Approved
- Payment Rejected
- Ready for Pickup

Core transaction must not depend on successful notification processing.

### Flow 13 — Trigger Worker

```text
Amazon SQS
→ Event
→ Lambda Worker
```

SQS triggers the notification worker.

### Flow 14 — Write In-app Notification

```text
Lambda Worker
→ Amazon DynamoDB
```

Worker persists the In-app Notification.

The diagram represents this as logically separated notification data while using the same DynamoDB service.

### Flow 15 — API Gateway Logs / Metrics

```text
Amazon API Gateway
→ Amazon CloudWatch
```

### Flow 16 — Backend Lambda Logs / Metrics

```text
Backend Lambda
→ Amazon CloudWatch
```

### Flow 17 — SQS Logs / Metrics

```text
Amazon SQS
→ Amazon CloudWatch
```

This represents queue monitoring/metrics in the architecture reference.

### Flow 18 — Worker Lambda Logs / Metrics

```text
Lambda Worker
→ Amazon CloudWatch
```

### Flow 19 — AWS Usage / Cost Monitoring

```text
Overall AWS Resources
→ AWS Usage
→ AWS Cost Explorer / Learner Lab Budget
```

---

## 5. File Flow Contract

Canonical paths:

```text
products/{organizationId}/{productId}/{uuid}
payments/{organizationId}/{orderId}/{uuid}
```

Required behavior:

1. Browser requests Pre-signed URL through the Backend API.
2. Backend authenticates the user.
3. Backend validates tenant / ownership / role as appropriate.
4. Backend generates the Pre-signed URL.
5. Browser uploads/downloads directly against S3 Files.
6. Payment Slip remains private.

No Frontend agent or Infrastructure agent may redefine this as a public payment-slip URL.

---

## 6. Notification Flow Contract

```text
Business operation
→ Write/commit core business result
→ Publish Notification Event to SQS
→ Worker processes event
→ Write In-app Notification
```

**FINAL invariant**

Notification failure must not make Order / Payment core transaction fail.

Exact retry / DLQ behavior is not defined by the source.

If introduced later, it must be marked as a **PROJECT DECISION**.

---

## 7. CloudWatch Contract

CloudWatch is expected to receive observability data for:

- API Gateway
- Backend Lambda
- SQS
- Notification Worker Lambda

Recommended source baseline:

```text
Log retention: 7 days
```

Exact log format / structured logging schema is not defined by the source and belongs to the Backend / Infrastructure specs.

---

## 8. CloudFormation Boundary

The Infrastructure implementation must create at least:

```text
Frontend S3 Bucket
Frontend Bucket Policy
Private Files S3 Bucket
DynamoDB AppTable
SQS NotificationQueue
Backend Lambda
Notification Worker Lambda
SQS EventSourceMapping
API Gateway REST API
API Deployment / Stage
CloudWatch Log Groups
```

Runtime Lambda role:

```text
arn:${AWS::Partition}:iam::${AWS::AccountId}:role/LabRole
```

Expected stack outputs:

```text
FrontendBucketName
FrontendWebsiteURL
FilesBucketName
AppTableName
NotificationQueueURL
BackendFunctionName
WorkerFunctionName
ApiBaseURL
```

Detailed resource properties belong to:

```text
docs/specs/infrastructure/SPEC.md
```

---

## 9. Learner Lab Constraints

Use:

```text
Region: us-east-1
IAM: LabRole
```

Avoid baseline dependencies on:

- EC2
- RDS
- NAT Gateway
- Load Balancer
- ECS / EKS
- Provisioned Lambda Concurrency
- CloudFront
- Cognito
- SES

The attached design is a Demo / Educational deployment architecture and is not a production-capacity benchmark.

---

## 10. Architecture Change Rules

A subsystem agent must not independently introduce or replace an AWS service.

Architecture changes that affect any of these must be treated as integration-impacting:

- Frontend hosting
- API Gateway
- Backend Lambda
- Authentication model
- DynamoDB
- Files S3
- SQS
- Worker Lambda
- CloudWatch
- Cost monitoring
- IAM role
- Region

Required process:

1. Update the Master Spec decision.
2. Update this Architecture Reference.
3. Update Shared Contracts if behavior changes.
4. Update affected subsystem specs.
5. Re-run integration/source-alignment review.

---

## 11. Non-Goals

This architecture does not include in the Learner Lab baseline:

- CloudFront
- Cognito
- SES
- EC2
- RDS
- NAT Gateway
- ALB
- ECS
- EKS
- Multi-region deployment
- Real payment gateway

Do not add them to implementation because they appeared in older project documents.
