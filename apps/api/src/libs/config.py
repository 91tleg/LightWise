import os


class Config:
    def __init__(self):
        self.AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
        self.TELEMETRY_BACKEND = os.getenv(
            "TELEMETRY_BACKEND", "influxdb"
        )

        # InfluxDB
        self.INFLUX_URL = os.getenv("INFLUX_URL", "")
        self.INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
        self.INFLUX_ORG = os.getenv("INFLUX_ORG", "")
        self.INFLUX_BUCKET = os.getenv(
            "INFLUX_BUCKET", "streetlight-telemetry"
        )

        # Timestream (legacy: used when TELEMETRY_BACKEND=timestream)
        self.TS_DATABASE = os.getenv("TS_DATABASE", "")
        self.TS_TABLE = os.getenv("TS_TABLE", "")

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
        self.DDB_TABLE_DOWNLINK_COMMANDS = os.getenv(
            "DDB_TABLE_DOWNLINK_COMMANDS",
            "DownlinkCommands"
        )

        # WebSocket
        self.WS_ENDPOINT = os.getenv("WS_ENDPOINT", "")
        self.WS_MANAGEMENT_URL = os.getenv("WS_MANAGEMENT_URL", "")

        # Auth
        self.COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
        self.COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
        self.AUTH_ENABLED = os.getenv(
            "AUTH_ENABLED", "true"
        ).lower() == "true"

        # App State
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
        self.LAMBDA_STAGE = os.getenv("LAMBDA_STAGE", "dev")


settings = Config()
