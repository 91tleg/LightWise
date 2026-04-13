import boto3
from libs.config import settings


_DYNAMODB = boto3.resource(
    "dynamodb",
    region_name=settings.AWS_REGION,
    endpoint_url=settings.DYNAMO_ENDPOINT or None,
)


def get_dynamodb_resource():
    return _DYNAMODB
