# Selenium setup for LibraCMS

This folder contains a beginner-friendly Selenium setup for the project.

## 1) Install Python dependencies

```bash
python -m venv venv
# Windows
venv\Scripts\activate
pip install -r selenium\requirements.txt
```

## 2) Start the app

Terminal 1:

```bash
cd WTProj/WTProj/client
npm install
npm run dev
```

Terminal 2:

```bash
cd WTProj/WTProj/server
npm install
npm run dev
```

## 3) Create an admin user if needed

The app includes a bootstrap endpoint for the first admin account.

```bash
python selenium\bootstrap_admin.py
```

This will POST to:

```text
http://localhost:3001/api/auth/bootstrap
```

with the sample credentials:

- email: admin@college.edu
- password: Admin@123

## 4) Run the login test

```bash
python selenium\test_login.py
```

The test opens the login page, enters the credentials, clicks Sign In, and waits until the app lands on either the dashboard or catalog page.

## 5) Update credentials for your DB

Open the file [selenium/test_login.py](test_login.py) and replace the sample email/password with a real account that already exists in your database.

## 6) Next tests to add

- invalid login
- catalog page loads
- add book form works
- issue book flow
- return book flow

