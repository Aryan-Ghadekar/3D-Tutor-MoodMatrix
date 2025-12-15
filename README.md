# Automated Lecture Summarizer and Note Generator with 3D Tutor

## 📌 Overview
It is an **AI-powered, cognitive load–aware adaptive learning platform** designed to enhance both **classroom teaching** and **post-class student revision**.  
The system continuously analyzes lecture context, student interaction, and emotional cues to dynamically adapt explanations, quizzes, and visual aids using **AI, RAG pipelines, and a 3D avatar tutor**.

The platform supports **two distinct logins**:
- **Teacher Login (Live Classroom)**
- **Student Login (Revision & Practice)**

---

## 🎯 Problem Statement
Traditional classroom teaching faces key challenges:
- Teachers lack **real-time visibility into student cognitive overload**
- Students hesitate to ask doubts during live lectures
- Explanations are often one-size-fits-all
- Post-lecture revision lacks contextual continuity
- Notes are static and manually prepared

These limitations lead to reduced comprehension, disengagement, and inefficient learning.

---

## 💡 Proposed Solution
The platform introduces a **dual-login intelligent learning system** that:
- Monitors **cognitive load during live lectures**
- Assists teachers in **pausing, assessing, and clarifying concepts**
- Enables students to **interactively revise and practice**
- Generates **context-aware quizzes, explanations, and notes**
- Uses a **3D avatar** for immersive explanations

---

## 👥 User Roles & Capabilities

### 👩‍🏫 Teacher Login (Live Classroom)
Teacher Login focuses on **real-time classroom intervention**.

#### Key Capabilities:
- Monitor **aggregate cognitive load trends** of students
- Detect overload using emotion & interaction signals
- Pause the lecture when overload is detected
- Trigger:
  - **Context-aware quizzes**
  - **3D avatar explanations**

#### Context Used for Adaptation:
- Last **2–3 minutes of lecture audio**
- Current PPT slide content
- Previous slide context (recent teaching window)

#### During Pause:
- Students attempt short quizzes **OR**
- 3D avatar explains:
  - Simplified explanations
  - Real-world examples
  - Visual illustrations
  - Alternative phrasing

This allows **concept clarification before proceeding further**.

---

### 👨‍🎓 Student Login (Revision & Practice)
Student Login supports **self-paced learning after the lecture**.

#### Key Capabilities:
- View lecture slides dynamically
- Ask doubts via **Ask Avatar** interface
- Receive:
  - Context-aware explanations
  - Derived slides
  - Visual and example-based clarification
- Practice concepts through adaptive explanations
- Revise content aligned strictly with what the teacher taught

---

## 🧠 Cognitive Load Analysis
The system infers **cognitive load** using emotional, behavioral, and interaction cues.

### Emotion Importance (Random Forest Model):
- Surprise
- Sad
- Fear
- Happy
- Neutral
- Angry
- Disgust

The model identified **surprise, sad, and fear** as the most influential emotional states affecting cognitive load, followed by **happy, neutral, angry, and disgust**.  
Accordingly, **weights are assigned to each emotion** to guide adaptive explanation and intervention strategies.

### Body Posture & Body Language Analysis
In addition to facial emotions, the system incorporates **body posture and behavioral cues** to improve cognitive load estimation:
- Slouching or leaning back
- Head resting on hands
- Fidgeting or restless movement
- Reduced upper-body engagement
- Inconsistent gaze or posture shifts

Pose landmarks and posture indicators are temporally smoothed and fused with emotion scores to produce a **more stable and reliable cognitive load signal**, especially in real classroom environments.

---

## 🔁 Cognitive Load Processing Pipeline

<p align="center">
  <img src="./assets/cognitive_load_pipeline.jpeg" width="1100" />
</p>

The pipeline combines **emotion-based** and **body posture–based** cognitive load estimation, followed by weighted fusion and temporal smoothing before adaptive actions are triggered.


---

## 🧩 Core System Features

### 1. Dynamic PPT & Slide Understanding
- Converts static PPT/PDF slides into structured representations
- Enables context-aware branching explanations
- Maintains lecture continuity

### 2. Mood Matrix (Interaction Workspace)
- Central UI for:
  - Slide viewing
  - Asking doubts
  - Explanation tracking
- Preserves learning context

### 3. RAG-Based Explanation Engine
- Uses **Retrieval-Augmented Generation**
- Retrieves:
  - Slide content
  - Lecture explanations
  - Past generated responses
- Ensures strict alignment with teacher-taught material

### 4. Quiz & Explanation Generation
- Quizzes generated from:
  - Recent audio context
  - Current slide
  - Slide history
- Used to assess understanding during cognitive overload

### 5. 3D Avatar Tutor
- Delivers explanations using:
  - Text-to-Speech (TTS)
  - Visual cues
- Supports:
  - Live classroom clarification
  - Student self-study

---

## 📝 Automated Notes Generation
After each session (Teacher or Student):
- The system compiles:
  - Generated explanations
  - Clarified concepts
  - Examples & visuals
- Notes are:
  - Context-aware
  - Lecture-aligned
  - Downloadable for students

---

## 🏗️ System Architecture

### Client Side
- Progressive Web App (PWA)
- Built with **Next.js**
- Interfaces:
  - Student Dashboard
  - Teacher Dashboard
  - Mood Matrix
  - Ask Avatar Panel

### Backend Services
- **FastAPI** as orchestration layer
- Handles:
  - Context management
  - Cognitive load routing
  - RAG pipeline
  - Quiz & explanation generation

### Data Layer
- SQL Database – sessions, users, interactions
- Vector Database – slides, explanations, embeddings
- Asset Storage – PPTs, PDFs, 3D assets

---

## 🔄 End-to-End Workflow

### Teacher Login
1. Lecture content uploaded
2. Live teaching begins
3. Cognitive load monitored
4. Overload detected
5. Lecture paused
6. Quiz / 3D avatar explanation triggered
7. Teaching resumes

### Student Login
1. Student opens revision session
2. Slides loaded dynamically
3. Student asks doubts
4. RAG retrieves context
5. 3D avatar explains
6. Notes generated post-session

---

## 🛠️ Technology Stack

### Frontend
- Next.js
- Tailwind CSS
- PWA

### Backend
- FastAPI
- LangChain
- Adaptive routing logic

### AI & ML
- Emotion detection models
- Random Forest (cognitive load)
- Pose estimation (body posture)
- Vector similarity search (RAG)

### 3D & Multimedia
- Unity / WebGL (3D Avatar)
- Text-to-Speech (TTS)
- Speech-to-Text (STT)

---

## 🚀 Key Innovations
- Cognitive load–driven classroom intervention
- Dual-login learning system (Teacher + Student)
- Emotion & posture–weighted adaptive explanations
- Context-preserving RAG pipelines
- 3D avatar–based tutoring
- Automated lecture-aligned notes

---

## 📈 Feasibility & Scalability
- Modular architecture
- Cloud-native backend
- Scalable vector databases
- Extendable across subjects and institutions

---

## 📄 Conclusion
The platform bridges the gap between **teaching intent and student understanding** by combining **AI, cognitive science, and immersive 3D technologies** to deliver adaptive, engaging, and effective learning experiences.
