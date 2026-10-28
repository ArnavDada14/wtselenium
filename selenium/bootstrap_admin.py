import requests

BASE_URL = "http://localhost:3001/api"

payload = {
    "email": "admin@college.edu",
    "password": "Admin@123",
    "name": "System Admin",
}

response = requests.post(f"{BASE_URL}/auth/bootstrap", json=payload)
print("Status:", response.status_code)
print(response.text)
