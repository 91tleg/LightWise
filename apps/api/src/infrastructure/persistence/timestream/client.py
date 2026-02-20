import boto3
from typing import Optional
from libs.config import settings

class TimestreamClientManager:
    _write_client: Optional[boto3.client] = None
    _query_client: Optional[boto3.client] = None

    @classmethod
    def get_write_client(cls):
        if cls._write_client is None:
            cls._write_client = boto3.client(
                "timestream-write", 
                region_name=settings.AWS_REGION
            )
        return cls._write_client

    @classmethod
    def get_query_client(cls):
        if cls._query_client is None:
            cls._query_client = boto3.client(
                "timestream-query", 
                region_name=settings.AWS_REGION
            )
        return cls._query_client
    