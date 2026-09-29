#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode

BASE_DIR = Path(__file__).resolve().parent

class CfnLoader(yaml.SafeLoader):
    pass


def construct_intrinsic(loader, _tag_suffix, node):
    if isinstance(node, ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, SequenceNode):
        return loader.construct_sequence(node)
    if isinstance(node, MappingNode):
        return loader.construct_mapping(node)
    return None


def construct_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError(f"duplicate YAML key: {key}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


CfnLoader.add_multi_constructor("!", construct_intrinsic)
CfnLoader.construct_mapping = construct_mapping

errors = []


def check(condition, message):
    if not condition:
        errors.append(message)


try:
    template = yaml.load((BASE_DIR / "template.yaml").read_text(), Loader=CfnLoader)
except Exception as exc:
    print("YAML_PARSE=FAIL")
    print(exc)
    sys.exit(2)

print("YAML_PARSE=PASS")

params = template.get("Parameters", {})
resources = template.get("Resources", {})
outputs = template.get("Outputs", {})

check({"StageName", "JWTSecret", "JWTExpiresIn"} <= set(params), "required parameters missing")
check(params.get("JWTSecret", {}).get("NoEcho") is True, "JWTSecret must be NoEcho")
check("Default" not in params.get("JWTSecret", {}), "JWTSecret must not have a default")

required = {
    "FrontendBucket": "AWS::S3::Bucket",
    "FrontendBucketPolicy": "AWS::S3::BucketPolicy",
    "FilesBucket": "AWS::S3::Bucket",
    "AppTable": "AWS::DynamoDB::Table",
    "NotificationQueue": "AWS::SQS::Queue",
    "BackendFunction": "AWS::Lambda::Function",
    "WorkerFunction": "AWS::Lambda::Function",
    "NotificationEventSourceMapping": "AWS::Lambda::EventSourceMapping",
    "ApiGatewayRestApi": "AWS::ApiGateway::RestApi",
    "ApiGatewayDeployment": "AWS::ApiGateway::Deployment",
    "ApiGatewayStage": "AWS::ApiGateway::Stage",
    "BackendInvokePermission": "AWS::Lambda::Permission",
    "BackendLogGroup": "AWS::Logs::LogGroup",
    "WorkerLogGroup": "AWS::Logs::LogGroup",
    "ApiAccessLogGroup": "AWS::Logs::LogGroup",
}
for name, resource_type in required.items():
    check(resources.get(name, {}).get("Type") == resource_type, f"{name} missing or wrong type")

forbidden = (
    "AWS::CloudFront::",
    "AWS::Cognito::",
    "AWS::SES::",
    "AWS::EC2::",
    "AWS::RDS::",
    "AWS::ECS::",
    "AWS::EKS::",
    "AWS::ElasticLoadBalancing::",
    "AWS::ElasticLoadBalancingV2::",
    "AWS::Budgets::",
    "AWS::IAM::Role",
    "AWS::IAM::User",
    "AWS::IAM::Group",
)
for name, resource in resources.items():
    resource_type = resource.get("Type", "")
    check(not any(resource_type.startswith(prefix) for prefix in forbidden),
          f"forbidden resource {name}: {resource_type}")

frontend = resources["FrontendBucket"]["Properties"]
check(frontend.get("WebsiteConfiguration", {}).get("IndexDocument") == "index.html",
      "FrontendBucket must serve index.html")
policy = resources["FrontendBucketPolicy"]["Properties"]["PolicyDocument"]["Statement"]
public_actions = []
for statement in policy:
    actions = statement.get("Action", [])
    public_actions += actions if isinstance(actions, list) else [actions]
check(set(public_actions) == {"s3:GetObject"}, "Frontend public policy must grant only s3:GetObject")

files = resources["FilesBucket"]["Properties"]
pab = files.get("PublicAccessBlockConfiguration", {})
check(all(pab.get(key) is True for key in
          ("BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets")),
      "FilesBucket Public Access Block must be fully enabled")
encryption = files.get("BucketEncryption", {}).get("ServerSideEncryptionConfiguration", [])
check(encryption and encryption[0]["ServerSideEncryptionByDefault"].get("SSEAlgorithm") == "AES256",
      "FilesBucket must use SSE-S3 AES256")
cors = files.get("CorsConfiguration", {}).get("CorsRules", [])
check(cors and set(cors[0].get("AllowedMethods", [])) == {"GET", "PUT", "HEAD"},
      "FilesBucket CORS must allow only GET/PUT/HEAD")
check(cors and cors[0].get("MaxAge") == 3000, "FilesBucket CORS MaxAge must be 3000")

table = resources["AppTable"]["Properties"]
check(table.get("BillingMode") == "PAY_PER_REQUEST", "AppTable must use PAY_PER_REQUEST")
attributes = {item["AttributeName"]: item["AttributeType"]
              for item in table.get("AttributeDefinitions", [])}
check(attributes == {"PK": "S", "SK": "S", "GSI1PK": "S", "GSI1SK": "S"},
      "AppTable key attributes mismatch")
gsis = table.get("GlobalSecondaryIndexes", [])
check(len(gsis) == 1 and gsis[0].get("IndexName") == "GSI1", "AppTable must define exactly GSI1")
check(gsis and gsis[0].get("Projection", {}).get("ProjectionType") == "ALL",
      "GSI1 projection must be ALL")

queue = resources["NotificationQueue"]["Properties"]
check(queue.get("VisibilityTimeout") == 120, "NotificationQueue VisibilityTimeout must be 120")
check("RedrivePolicy" not in queue, "NotificationQueue must not have a DLQ/redrive policy")
check(queue.get("FifoQueue") is not True, "NotificationQueue must be Standard")
check(sum(r.get("Type") == "AWS::SQS::Queue" for r in resources.values()) == 1,
      "MVP must create exactly one SQS queue")

backend = resources["BackendFunction"]["Properties"]
check((backend.get("Runtime"), backend.get("Handler"), backend.get("MemorySize"), backend.get("Timeout"))
      == ("nodejs22.x", "src/lambda.handler", 512, 28), "Backend Lambda configuration mismatch")
check(backend.get("Code") == "../backend/.build/lambda/", "Backend Lambda artifact path mismatch")
backend_env = backend.get("Environment", {}).get("Variables", {})
check(set(backend_env) == {
    "NODE_ENV", "APP_TABLE_NAME", "FILES_BUCKET_NAME", "NOTIFICATION_QUEUE_URL",
    "JWT_SECRET", "JWT_EXPIRES_IN", "CORS_ALLOWED_ORIGINS"
}, "Backend Lambda environment contract mismatch")
check("AWS_REGION" not in backend_env, "Backend Lambda must not inject AWS_REGION")
check("role/LabRole" in str(backend.get("Role", "")), "Backend Lambda must use LabRole")

worker = resources["WorkerFunction"]["Properties"]
check((worker.get("Runtime"), worker.get("Handler"), worker.get("MemorySize"), worker.get("Timeout"))
      == ("nodejs22.x", "src/worker.handler", 256, 30), "Worker Lambda configuration mismatch")
check(worker.get("Code") == "../backend/.build/lambda/", "Worker Lambda artifact path mismatch")
worker_env = worker.get("Environment", {}).get("Variables", {})
check(set(worker_env) == {"NODE_ENV", "APP_TABLE_NAME"}, "Worker Lambda environment contract mismatch")
check("AWS_REGION" not in worker_env, "Worker Lambda must not inject AWS_REGION")
check("role/LabRole" in str(worker.get("Role", "")), "Worker Lambda must use LabRole")

mapping = resources["NotificationEventSourceMapping"]["Properties"]
check(mapping.get("Enabled") is True and mapping.get("BatchSize") == 10,
      "Notification EventSourceMapping enabled/batch settings mismatch")
check(mapping.get("FunctionResponseTypes") == ["ReportBatchItemFailures"],
      "Notification EventSourceMapping must use ReportBatchItemFailures")

for method in ("ApiGatewayRootAnyMethod", "ApiGatewayProxyAnyMethod"):
    props = resources[method]["Properties"]
    integration = props.get("Integration", {})
    check(props.get("HttpMethod") == "ANY", f"{method} must be ANY")
    check(integration.get("Type") == "AWS_PROXY" and integration.get("IntegrationHttpMethod") == "POST",
          f"{method} must use Lambda proxy POST integration")

for method in ("ApiGatewayRootOptionsMethod", "ApiGatewayProxyOptionsMethod"):
    props = resources[method]["Properties"]
    check(props.get("HttpMethod") == "OPTIONS" and props.get("Integration", {}).get("Type") == "MOCK",
          f"{method} CORS preflight configuration mismatch")

invoke_source = str(resources["BackendInvokePermission"]["Properties"].get("SourceArn", ""))
check(invoke_source.endswith("/*/*/*") and "${ApiGatewayRestApi}" in invoke_source,
      "BackendInvokePermission SourceArn must cover all stages/methods/resources for this API only")

deployment_dependencies = set(resources["ApiGatewayDeployment"].get("DependsOn", []))
check({
    "ApiGatewayRootAnyMethod", "ApiGatewayProxyAnyMethod",
    "ApiGatewayRootOptionsMethod", "ApiGatewayProxyOptionsMethod"
} <= deployment_dependencies, "ApiGatewayDeployment dependencies incomplete")

stage = resources["ApiGatewayStage"]["Properties"]
check(bool(stage.get("AccessLogSetting")), "API access logging missing")
access_format = str(stage.get("AccessLogSetting", {}).get("Format", ""))
check("Authorization" not in access_format and "JWT" not in access_format,
      "API access log format must not include Authorization/JWT")
settings = stage.get("MethodSettings", [])
check(settings and settings[0].get("MetricsEnabled") is True, "API stage metrics must be enabled")

for log_group in ("BackendLogGroup", "WorkerLogGroup", "ApiAccessLogGroup"):
    check(resources[log_group]["Properties"].get("RetentionInDays") == 7,
          f"{log_group} retention must be 7 days")

expected_outputs = {
    "FrontendBucketName", "FrontendWebsiteURL", "FilesBucketName", "AppTableName",
    "NotificationQueueURL", "BackendFunctionName", "WorkerFunctionName", "ApiBaseURL"
}
check(set(outputs) == expected_outputs, "stack output names mismatch")
check("/api/v1" not in str(outputs["ApiBaseURL"].get("Value", "")),
      "ApiBaseURL must not contain /api/v1")

with (BASE_DIR / "parameters.example.json").open() as stream:
    example = json.load(stream)
example_keys = {item["ParameterKey"] for item in example}
check("JWTSecret" not in example_keys, "parameters.example.json must not contain JWTSecret")
check({"StageName", "JWTExpiresIn"} <= example_keys, "safe example parameters missing")

readme = (BASE_DIR / "README.md").read_text()
for token in (
    "us-east-1", "LabRole", "backend/.build/lambda/", "aws cloudformation package",
    "aws cloudformation deploy", "FrontendBucketName", "ApiBaseURL",
    "CloudFront", "Cognito", "SES", "non-empty S3 buckets"
):
    check(token in readme, f"README missing required documentation: {token}")

if errors:
    print(f"CONTRACT_CHECK=FAIL ({len(errors)} findings)")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("CONTRACT_CHECK=PASS")
print(f"RESOURCE_COUNT={len(resources)}")
print(f"OUTPUT_COUNT={len(outputs)}")
