import os
import time
import pytest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


BASE_URL = os.getenv(
    "BASE_URL",
    "https://belleza-conceptual.onrender.com"
)


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()

    headless = os.getenv("HEADLESS", "false").lower() == "true"

    if headless:
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
    else:
        options.add_argument("--start-maximized")

    driver = webdriver.Chrome(options=options)

    yield driver

    driver.quit()


def scroll_and_click(driver, element):
    driver.execute_script(
        "arguments[0].scrollIntoView({block: 'center'});",
        element
    )

    time.sleep(0.5)

    element.click()


def test_catalog_loads_products(driver):
    driver.get(BASE_URL)

    wait = WebDriverWait(driver, 30)

    products = wait.until(
        EC.presence_of_all_elements_located(
            (By.CLASS_NAME, "product-card")
        )
    )

    assert len(products) > 0


def test_category_filters_are_visible(driver):
    driver.get(BASE_URL)

    wait = WebDriverWait(driver, 30)

    filters = wait.until(
        EC.presence_of_all_elements_located(
            (By.CLASS_NAME, "filter-pill")
        )
    )

    assert len(filters) > 0


def test_add_product_to_cart(driver):
    driver.get(BASE_URL)

    wait = WebDriverWait(driver, 30)

    add_button = wait.until(
        EC.element_to_be_clickable(
            (
                By.CSS_SELECTOR,
                ".add-btn:not([disabled])"
            )
        )
    )

    scroll_and_click(driver, add_button)

    cart_count = wait.until(
        EC.presence_of_element_located(
            (By.ID, "cartCount")
        )
    )

    assert int(cart_count.text) > 0

    drawer = wait.until(
        EC.presence_of_element_located(
            (By.ID, "drawer")
        )
    )

    assert "open" in drawer.get_attribute("class")


def test_checkout_required_fields_validation(driver):
    driver.get(BASE_URL)

    wait = WebDriverWait(driver, 30)

    add_button = wait.until(
        EC.element_to_be_clickable(
            (
                By.CSS_SELECTOR,
                ".add-btn:not([disabled])"
            )
        )
    )

    scroll_and_click(driver, add_button)

    continue_button = wait.until(
        EC.element_to_be_clickable(
            (By.ID, "toCheckout")
        )
    )

    scroll_and_click(driver, continue_button)

    submit_button = wait.until(
        EC.element_to_be_clickable(
            (By.ID, "submitOrder")
        )
    )

    scroll_and_click(driver, submit_button)

    message = wait.until(
        EC.visibility_of_element_located(
            (By.ID, "formMsg")
        )
    )

    assert "Nombre y teléfono son obligatorios" in message.text