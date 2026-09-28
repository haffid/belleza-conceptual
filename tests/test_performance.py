import os
import time
import requests

BASE_URL = os.getenv(
    "BASE_URL",
    "https://belleza-conceptual.onrender.com"
)

MAX_RESPONSE_SECONDS = float(
    os.getenv("MAX_RESPONSE_SECONDS", "5")
)


def test_health_response_time():
    # Primera llamada para despertar/calentar el servicio de Render.
    requests.get(f"{BASE_URL}/health", timeout=60)

    start = time.perf_counter()

    response = requests.get(
        f"{BASE_URL}/health",
        timeout=30
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < MAX_RESPONSE_SECONDS


def test_products_response_time():
    # Primera llamada para evitar medir el arranque en frío de Render.
    requests.get(f"{BASE_URL}/api/products", timeout=60)

    start = time.perf_counter()

    response = requests.get(
        f"{BASE_URL}/api/products",
        timeout=30
    )

    elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < MAX_RESPONSE_SECONDS