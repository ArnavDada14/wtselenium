from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


def login_test(email: str, password: str):
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
    wait = WebDriverWait(driver, 15)

    try:
        driver.get("http://localhost:5173/login")

        email_input = wait.until(EC.visibility_of_element_located((By.ID, "email")))
        password_input = driver.find_element(By.ID, "password")
        login_button = driver.find_element(By.ID, "login-submit")

        email_input.clear()
        email_input.send_keys(email)

        password_input.clear()
        password_input.send_keys(password)

        login_button.click()

        # The app redirects to dashboard for librarians/admins or catalog for students.
        wait.until(lambda d: "/dashboard" in d.current_url or "/catalog" in d.current_url)

        print("Login successful. Current URL:", driver.current_url)
        return True
    finally:
        driver.quit()


if __name__ == "__main__":
    # Replace these with a real user in your DB.
    login_test("admin@college.edu", "Admin@123")
