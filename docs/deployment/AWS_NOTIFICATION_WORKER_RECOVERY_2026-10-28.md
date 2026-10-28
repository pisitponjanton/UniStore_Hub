# AWS Notification Worker — Recovery and Verification (2026-10-28)

## Scope
AWS Academy Learner Lab, Region `us-east-1`, CloudFormation stack `unistore-hub-dev`. This is a **runtime configuration recovery**, not a Backend/Frontend code deployment.

## Reported symptom
The Buyer notification page returned HTTP 200 but displayed no notifications after a simulated payment approval and a Ready for Pickup event in a complete QA checkout flow.

## Verified cause
The Lambda Event Source Mapping connecting `NotificationQueue` (SQS) to `WorkerFunction` had **State = Disabled** and **StateTransitionReason = USER_INITIATED**. The CloudFormation template declares `Enabled: true` and the original deployment smoke test had previously passed. The identity or reason behind the later change was not determined.

At diagnosis:
- SQS visible queued messages: **2**
- SQS in-flight messages: **0**
- Event Source Mapping: **Disabled**
- Worker Lambda: **Active**
- No `notification_publish_failed` events were found in the Backend logs queried.

## Recovery performed via cloudshell-user
1. Confirmed AWS account and `us-east-1`, stack resource IDs and the specific Event Source Mapping UUID.
2. Restored only the mapping configuration using the AWS CLI:
   `aws lambda update-event-source-mapping --uuid <verified-uuid> --enabled --region us-east-1`
3. Checked mapping until **Enabled**.
4. Verified SQS backlog fell from **2 → 0** with no in-flight messages.
5. Confirmed Worker Lambda executed and did not emit worker error events in the inspected log stream.
6. Logged in to the **existing QA Buyer** and confirmed `GET /notifications` → HTTP 200 with two notifications: **Payment Approved** and **Ready for Pickup**.
7. Ran `backend/tests/notifications.test.js`: **18/18 PASS**.
8. Installed and ran a read-only verification script in CloudShell: `/home/cloudshell-user/unistore-verify-notification-pipeline.sh`. The source is in `scripts/verify-notification-pipeline.sh`.

## Post-recovery result
- Lambda Event Source Mapping: **Enabled**
- SQS visible: **0**
- SQS in-flight: **0**
- Notifications visible for QA Buyer: **2**
- No change to existing Order/Payment/Pickup data.
- **No CloudFormation Stack update or Backend/Frontend re-build was needed**: checked source code and tests showed no application defect; the deployment template already specified the correct mapping state. Re-enabling the live mapping was the minimal required configuration deployment.

## Future safeguards
Run this read-only check after deployment and whenever Notifications appear empty:

```bash
AWS_EXPECTED_ACCOUNT_ID=<expected-lab-account> bash scripts/verify-notification-pipeline.sh
```

If mapping is disabled, investigate why and review pending SQS messages before re-enabling. Do not purge the Queue, delete CloudFormation stacks or blindly replay messages. An empty queue plus Enabled mapping alone does **not** certify user-facing delivery; also confirm `/notifications` with an authenticated test user.

## Notes
The mapping change was user-authorized. No payment transfer occurred: QA payment evidence was a marked **TEST ONLY** image. Do not include login credentials, user tokens, AWS secrets or Pickup QR/Token images in shared reports.


## Reproducible deployment behavior
The source deployment flow now runs `scripts/reconcile-notification-pipeline.sh` in `scripts/deploy-all.sh`, after deploying the CloudFormation stack and reading its outputs, and before publishing the frontend.
- Confirms the intended AWS account, region, stack and exact SQS/Worker resource pair.
- If that single mapping is Disabled, re-enables it and verifies it reaches Enabled.
- If Enabled already, the step is non-mutating.
- If the mapping is missing/ambiguous or in an unexpected state, the deployment fails closed.
- `scripts/verify-notification-pipeline.sh` remains a read-only operational check.

This prevents future drift from being silently accepted by an otherwise successful deployment.
