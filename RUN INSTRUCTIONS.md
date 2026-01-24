## 🚀 How to Run the Project

This project consists of **three services** that must be run **simultaneously**, each in a **separate terminal window**.

---

### 1️⃣ Node.js Backend — Cognitive Load & Quizzes  
**Port:** `5000`

Handles real-time cognitive load tracking and quiz logic.

```bash
cd backend
npm install
npm run dev
```

### 2️⃣ FastAPI Backend — AI, RAG & Study Plan Generation
Port: 8000 (default)

Acts as the RAG engine responsible for PDF processing, LLM inference, and study plan generation.

cd backend/fastapi-service

### Create a virtual environment (recommended)
```bash
python3 -m venv venv
source venv/bin/activate
```

### Install dependencies
```bash
pip install -r requirements.txt
```

### Run the server
```bash
uvicorn main:app --reload
```

### 3️⃣ Frontend — Next.js User Interface
Port: 3000

```bash
cd frontend
npm install
npm run dev
```

🛠 Setup Requirements
Node.js (v18+ recommended)

Python (v3.8+ required, v3.10–3.11 recommended)

npm or yarn

🔐 Environment Variables
Check for .env files in the following directories:

```bash
backend/

backend/fastapi-service/

frontend/
```
You may need to add environment variables such as:

OPENROUTER_API_KEY=your_api_key_here
(especially in backend/fastapi-service/.env)

🌐 Access the Application
Once all services are running, open:

http://localhost:3000
