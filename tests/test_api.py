import os
import requests

BASE_URL = os.getenv(
    "BASE_URL",
    "https://belleza-conceptual.onrender.com"
)


def test_health_status_code():
    response = requests.get(f"{BASE_URL}/health", timeout=30)

    assert response.status_code == 200


def test_health_service_status():
    response = requests.get(f"{BASE_URL}/health", timeout=30)

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
    assert data["db"] == "up"


def test_products_status_code():
    response = requests.get(f"{BASE_URL}/api/products", timeout=30)

    assert response.status_code == 200


def test_products_returns_list():
    response = requests.get(f"{BASE_URL}/api/products", timeout=30)

    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0