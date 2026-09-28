import os
import requests

BASE_URL = os.getenv(
    "BASE_URL",
    "https://belleza-conceptual.onrender.com"
)


def test_unknown_route_returns_404():
    response = requests.get(
        f"{BASE_URL}/api/ruta-inexistente",
        timeout=30
    )

    assert response.status_code == 404


def test_order_without_client_returns_400():
    payload = {
        "items": [
            {
                "id_producto": 1,
                "cantidad": 1
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/orders",
        json=payload,
        timeout=30
    )

    assert response.status_code == 400


def test_order_without_items_returns_400():
    payload = {
        "cliente": {
            "nombre": "Prueba QA",
            "telefono": "55555555"
        },
        "items": []
    }

    response = requests.post(
        f"{BASE_URL}/api/orders",
        json=payload,
        timeout=30
    )

    assert response.status_code == 400


def test_order_with_zero_quantity_returns_400():
    payload = {
        "cliente": {
            "nombre": "Prueba QA",
            "telefono": "55555555"
        },
        "items": [
            {
                "id_producto": 1,
                "cantidad": 0
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/orders",
        json=payload,
        timeout=30
    )

    assert response.status_code == 400


def test_order_with_negative_quantity_returns_400():
    payload = {
        "cliente": {
            "nombre": "Prueba QA",
            "telefono": "55555555"
        },
        "items": [
            {
                "id_producto": 1,
                "cantidad": -1
            }
        ]
    }

    response = requests.post(
        f"{BASE_URL}/api/orders",
        json=payload,
        timeout=30
    )

    assert response.status_code == 400


def test_unknown_order_returns_404():
    response = requests.get(
        f"{BASE_URL}/api/orders/BC-99999999",
        timeout=30
    )

    assert response.status_code == 404