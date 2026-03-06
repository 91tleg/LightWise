from influxdb_client import InfluxDBClient
from libs.config import settings


class InfluxClientManager:
    _client: InfluxDBClient | None = None

    @classmethod
    def get_client(cls) -> InfluxDBClient:
        if cls._client is None:
            if not settings.INFLUX_URL or not settings.INFLUX_TOKEN:
                raise RuntimeError(
                    "INFLUX_URL and INFLUX_TOKEN must be set"
                )
            cls._client = InfluxDBClient(
                url=settings.INFLUX_URL,
                token=settings.INFLUX_TOKEN,
                org=settings.INFLUX_ORG,
            )
        return cls._client

    @classmethod
    def close(cls) -> None:
        if cls._client is not None:
            cls._client.close()
            cls._client = None
