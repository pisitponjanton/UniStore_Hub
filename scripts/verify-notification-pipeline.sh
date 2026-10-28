#!/usr/bin/env bash
# Read-only health check for the deployed SQS → Notification Worker mapping.
set -euo pipefail
export AWS_PAGER=""
STACK_NAME="${STACK_NAME:-unistore-hub-dev}"
REGION="${AWS_REGION:-us-east-1}"
EXPECTED_ACCOUNT="${AWS_EXPECTED_ACCOUNT_ID:-}"

account="$(aws sts get-caller-identity --query Account --output text --region "$REGION")"
if [[ -n "$EXPECTED_ACCOUNT" && "$account" != "$EXPECTED_ACCOUNT" ]]; then
  echo "ERROR: unexpected AWS account" >&2
  exit 2
fi

output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue|[0]" \
    --output text
}
worker="$(output WorkerFunctionName)"
queue="$(output NotificationQueueURL)"
if [[ -z "$worker" || "$worker" == "None" || -z "$queue" || "$queue" == "None" ]]; then
  echo "ERROR: missing WorkerFunctionName / NotificationQueueURL" >&2
  exit 2
fi

queue_arn="$(aws sqs get-queue-attributes --queue-url "$queue" --attribute-names QueueArn --region "$REGION" --query 'Attributes.QueueArn' --output text)"
mapping_state="$(aws lambda list-event-source-mappings --function-name "$worker" --event-source-arn "$queue_arn" --region "$REGION" --query 'EventSourceMappings[0].State' --output text)"
queue_visible="$(aws sqs get-queue-attributes --queue-url "$queue" --attribute-names ApproximateNumberOfMessages --region "$REGION" --query 'Attributes.ApproximateNumberOfMessages' --output text)"
queue_inflight="$(aws sqs get-queue-attributes --queue-url "$queue" --attribute-names ApproximateNumberOfMessagesNotVisible --region "$REGION" --query 'Attributes.ApproximateNumberOfMessagesNotVisible' --output text)"

printf 'Stack: %s\nRegion: %s\nMapping state: %s\nSQS visible: %s\nSQS in-flight: %s\n' \
  "$STACK_NAME" "$REGION" "$mapping_state" "$queue_visible" "$queue_inflight"

if [[ "$mapping_state" != "Enabled" ]]; then
  echo "FAIL: notification worker event source mapping is not Enabled." >&2
  exit 1
fi
echo "PASS: Notification Worker event source mapping is Enabled."
