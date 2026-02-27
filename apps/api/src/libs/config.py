import os


class Config:
    def __init__(self):
        self.AWS_REGION = os.getenv("AWS_REGION", "us-west-2")

        # Timestream
        self.TS_DATABASE = os.getenv("TS_DATABASE", "IoTDatabase")
        self.TS_TABLE = os.getenv("TS_TABLE", "StreetlightMetrics")

        # DynamoDB
        self.DYNAMO_ENDPOINT = os.getenv("DYNAMO_ENDPOINT", "")
        self.DDB_TABLE_STREETLIGHTS = os.getenv(
            "DDB_TABLE_STREETLIGHTS",
            "Streetlights"
        )
        self.DDB_TABLE_STREETLIGHT_METADATA = os.getenv(
            "DDB_TABLE_STREETLIGHT_METADATA",
            "StreetlightMetadata"
        )
        self.DDB_TABLE_USERS_AND_TENANTS = os.getenv(
            "DDB_TABLE_USERS_AND_TENANTS",
            "UsersAndTenants"
        )
        self.DDB_TABLE_WS_CONNECTIONS = os.getenv(
            "DDB_TABLE_WS_CONNECTIONS",
            "WebSocketConnections"
        )

        # WebSocket
        self.WS_ENDPOINT = os.getenv("WS_ENDPOINT", "")

        # Auth
        self.COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
        self.COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
        self.AUTH_ENABLED = os.getenv("AUTH_ENABLED")

        # App State
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
        self.LAMBDA_STAGE = os.getenv("LAMBDA_STAGE", "dev")

    @property
    def ws_management_url(self) -> str:
        """
        Formats the wss:// endpoint into an https:// endpoint
        required by the Boto3 ApiGatewayManagementApi client.
        """
        if not self.WS_ENDPOINT:
            return ""
        return self.WS_ENDPOINT.replace("wss://", "https://")


settings = Config()
