import sys
import warnings
warnings.filterwarnings("ignore")

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid
import tempfile
import pdfplumber
import whisper
import os
import requests
from sentence_transformers import SentenceTransformer, util
from datetime import date, datetime
from dotenv import load_dotenv
import json
from pathlib import Path
from pptx import Presentation
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp
import random

# =========================================================
# ENV
# =========================================================
load_dotenv()

# =========================================================
# APP INIT
# =========================================================
app = FastAPI(title="Study Plan Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# PYDANTIC MODELS
# =========================================================
class MCQRequest(BaseModel):
    lecture_plan: dict
    num_questions: int = 10
    question_types: List[str] = []

class AnswerAnalysisRequest(BaseModel):
    session_id: str
    questions: List[dict]
    answers: List[dict]
    student_goal: Optional[str] = None

class SaveResultsRequest(BaseModel):
    session_id: str
    lecture_id: str
    score: float
    correct: int
    total: int
    questions: List[dict]
    answers: List[dict]
    misconceptions: List[dict]
    weak_topics: List[str]
    recommendations: List[str]

# =========================================================
# ML MODELS
# =========================================================
whisper_model = whisper.load_model("base")
semantic_model = SentenceTransformer("all-MiniLM-L6-v2")

# =========================================================
# OPENROUTER CONFIG
# =========================================================
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-3.5-turbo"

# =========================================================
# CONSTANTS
# =========================================================
KEYWORDS = {
    "important": 1.0, "remember": 0.8, "note": 0.6, "exam": 0.9,
    "key": 0.7, "essential": 0.8, "critical": 0.9, "main": 0.7,
    "chapter": 0.85, "section": 0.7, "unit": 0.8, "concept": 0.75
}

# =========================================================
# EXTRACTION HELPERS
# =========================================================
def extract_pdf_text(pdf_file: UploadFile) -> str:
    text = ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_file.file.read())
        tmp_path = tmp.name

    try:
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                if page.extract_text():
                    text += page.extract_text() + "\n"
    finally:
        os.unlink(tmp_path)

    return text.strip()

def extract_ppt_text(ppt_file: UploadFile) -> str:
    text = ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pptx") as tmp:
        tmp.write(ppt_file.file.read())
        tmp_path = tmp.name

    try:
        prs = Presentation(tmp_path)
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text += shape.text + "\n"
    finally:
        os.unlink(tmp_path)

    return text.strip()

def transcribe_audio(audio_file: UploadFile) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_file.file.read())
        tmp_path = tmp.name

    try:
        return whisper_model.transcribe(tmp_path)["text"]
    finally:
        os.unlink(tmp_path)

def process_yt_link(yt_link: str) -> str:
    video_id = yt_link.split("v=")[-1].split("&")[0]
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([item['text'] for item in transcript])
    except:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            audio_path = tmp.name
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': audio_path.replace('.wav', ''),
            'quiet': True,
            'no_warnings': True,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([yt_link])
            
            import glob
            downloaded_files = glob.glob(audio_path.replace('.wav', '') + '*')
            if downloaded_files:
                actual_path = downloaded_files[0]
                transcript = whisper_model.transcribe(actual_path)["text"]
                os.unlink(actual_path)
            else:
                raise Exception("Download failed")
                
        except Exception as e:
            print(f"YouTube processing error: {e}")
            return "YouTube transcription failed"
        
        return transcript

# =========================================================
# TEXT PROCESSING HELPERS
# =========================================================
def chunk_text(text: str, max_tokens: int = 150):
    """Improved chunking with better token limits"""
    words = text.split()
    chunks, current = [], []

    for w in words:
        current.append(w)
        if len(current) >= max_tokens:
            chunks.append(" ".join(current))
            current = []

    if current:
        chunks.append(" ".join(current))

    return chunks

def calculate_topic_count(text_length: int) -> int:
    """Dynamic topic count based on content length"""
    word_count = len(text_length.split())
    
    if word_count < 500:
        return 3
    elif word_count < 1500:
        return 5
    elif word_count < 3000:
        return 8
    elif word_count < 5000:
        return 12
    elif word_count < 10000:
        return 15
    else:
        return 20

def extract_features(chunks, transcript):
    embeddings = semantic_model.encode(chunks)
    doc_embedding = embeddings.mean(axis=0)
    features = []

    for i, chunk in enumerate(chunks):
        semantic = float(util.cos_sim(embeddings[i], doc_embedding)[0][0])
        keyword = min(sum(v for k, v in KEYWORDS.items() if k in chunk.lower()), 1.0)
        duration = min(len(chunk.split()) / 150, 1.0)

        audio = 0.0
        if transcript:
            for s in transcript.split("."):
                if any(k in s.lower() for k in KEYWORDS) and chunk[:100] in s:
                    audio = 1.0
                    break

        features.append({
            "semantic": semantic,
            "keyword": keyword,
            "duration": duration,
            "audio": audio
        })

    return features

def compute_importance(features):
    return [
        0.35 * f["semantic"]
        + 0.25 * f["audio"]
        + 0.20 * f["duration"]
        + 0.20 * f["keyword"]
        for f in features
    ]

def label_importance(score):
    if score >= 0.70:
        return "high"
    elif score >= 0.45:
        return "medium"
    return "low"

# =========================================================
# LLM GENERATION HELPERS
# =========================================================
def generate_topic_title(text):
    """Generate concise, meaningful topic titles"""
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": "You are an expert educator. Generate a clear, concise topic title (max 10 words) that captures the main concept. Focus on key technical terms and concepts."},
            {"role": "user", "content": f"Generate a topic title for this content:\n\n{text[:1000]}"}
        ],
        "temperature": 0.3,
        "max_tokens": 40
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=15)
        r.raise_for_status()
        title = r.json()["choices"][0]["message"]["content"].strip()
        title = title.replace('"', '').replace("'", '').strip()
        return title[:100]
    except Exception as e:
        print(f"Title generation failed: {e}")
        words = text.split()[:8]
        return " ".join(words) + "..."

def generate_summary(text):
    """Generate concise summary instead of full chunk"""
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": "Summarize the following content in 2-3 clear, informative sentences. Focus on key concepts and technical details."},
            {"role": "user", "content": text[:1500]}
        ],
        "temperature": 0.4,
        "max_tokens": 150
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=15)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Summary generation failed: {e}")
        return text[:300] + "..."

def generate_structured_content(prompt, text, expected_format="list"):
    """Generate structured content with better parsing"""
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": f"{prompt}\n\nIMPORTANT: Return ONLY a JSON array of strings, nothing else. Example: [\"item 1\", \"item 2\", \"item 3\"]"},
            {"role": "user", "content": text[:1200]}
        ],
        "temperature": 0.5,
        "max_tokens": 200
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=15)
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"].strip()
        
        try:
            content = content.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(content)
            if isinstance(parsed, list):
                return parsed[:4]
            return [str(parsed)]
        except:
            if "\n" in content:
                items = [line.strip("- •").strip() for line in content.split("\n") if line.strip()]
            else:
                items = [item.strip() for item in content.split(",")]
            return [item for item in items if item][:4]
    except Exception as e:
        print(f"Structured content generation failed: {e}")
        return ["Content generation failed - check API key and connection"]

# =========================================================
# ANALYSIS FUNCTIONS
# =========================================================
def analyze_text(pdf_text, ppt_text, transcript):
    combined_text = pdf_text + " " + ppt_text
    chunks = chunk_text(combined_text)
    features = extract_features(chunks, transcript)
    scores = compute_importance(features)

    analyzed = []
    for i, c in enumerate(chunks):
        analyzed.append({
            "text": c,
            "score": scores[i],
            "importance": label_importance(scores[i])
        })

    analyzed.sort(key=lambda x: x["score"], reverse=True)
    topic_count = calculate_topic_count(combined_text)
    
    return {
        "chunks": analyzed[:topic_count],
        "has_audio": transcript is not None,
        "total_chunks": len(analyzed),
        "word_count": len(combined_text.split())
    }

def build_lecture_plan(data):
    """Build comprehensive lecture plan with dynamic topics"""
    topics = []
    chunk_count = min(len(data["chunks"]), 20)
    
    print(f"Generating {chunk_count} topics from {data.get('word_count', 0)} words...")
    
    for i, c in enumerate(data["chunks"][:chunk_count]):
        print(f"Processing topic {i+1}/{chunk_count}...")
        
        title = generate_topic_title(c["text"])
        summary = generate_summary(c["text"])
        
        prerequisites = generate_structured_content(
            "List 2-3 key prerequisites or background knowledge needed to understand this topic",
            c["text"]
        )
        
        misconceptions = generate_structured_content(
            "List 2-3 common misconceptions or mistakes students make about this topic",
            c["text"]
        )
        
        insights = generate_structured_content(
            "List 2-3 key insights, takeaways, or important points from this topic",
            c["text"]
        )

        topics.append({
            "id": f"topic-{i+1}",
            "title": title,
            "description": summary,
            "full_content": c["text"][:500],
            "importance": c["importance"],
            "weightage": round(c["score"] * 100, 2),
            "prerequisites": prerequisites,
            "commonMisconceptions": misconceptions,
            "keyInsights": insights
        })

    all_text = " ".join([c["text"] for c in data["chunks"][:5]])
    
    overall_topic = generate_topic_title(all_text)
    duration = generate_structured_content(
        "Estimate lecture duration based on content complexity. Return as single string like '45-60 minutes'",
        all_text
    )[0] if data["chunks"] else "30-45 minutes"
    
    instructor = generate_structured_content(
        "Suggest appropriate instructor role/expertise for this content. Return single string like 'Computer Architecture Professor'",
        all_text
    )[0] if data["chunks"] else "Subject Matter Expert"

    return {
        "sessionId": str(uuid.uuid4()),
        "lectureId": str(uuid.uuid4()),
        "topic": overall_topic,
        "duration": duration,
        "date": str(date.today()),
        "instructor": instructor,
        "impTopics": topics,
        "metadata": {
            "analysisDepth": "signal-weighted-enhanced",
            "confidenceScore": round(
                sum(c["score"] for c in data["chunks"][:chunk_count]) / max(chunk_count, 1), 2
            ),
            "fallbackUsed": not data["has_audio"],
            "totalTopicsGenerated": len(topics),
            "wordCount": data.get("word_count", 0),
            "processingVersion": "2.0"
        }
    }

# =========================================================
# IMPROVED MCQ GENERATION
# =========================================================
def generate_mcq_with_llm(topic_title, content, insights):
    """Generate high-quality MCQ using LLM"""
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system", 
                "content": """You are an expert educator creating multiple choice questions. 
Generate a question with 4 options (A, B, C, D) where:
- Question tests understanding of the concept
- Options are plausible and similar in length
- Only ONE option is clearly correct
- Wrong options are believable but incorrect
- Avoid obvious patterns

Return ONLY valid JSON in this exact format:
{
  "question": "Question text here?",
  "options": [
    {"id": "A", "text": "First option", "isCorrect": true},
    {"id": "B", "text": "Second option", "isCorrect": false},
    {"id": "C", "text": "Third option", "isCorrect": false},
    {"id": "D", "text": "Fourth option", "isCorrect": false}
  ],
  "explanation": "Why the correct answer is correct"
}"""
            },
            {
                "role": "user", 
                "content": f"""Topic: {topic_title}

Content: {content[:800]}

Key Points: {', '.join(insights[:2]) if insights else 'See content above'}

Generate a multiple choice question testing this concept."""
            }
        ],
        "temperature": 0.7,
        "max_tokens": 400
    }

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=20)
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"].strip()
        
        # Clean JSON
        content = content.replace("```json", "").replace("```", "").strip()
        mcq_data = json.loads(content)
        
        return mcq_data
    except Exception as e:
        print(f"LLM MCQ generation failed: {e}")
        return None

def create_diagnostic_question(qid, topic, content, misconceptions, insights):
    """Create a high-quality diagnostic MCQ"""
    title = topic.get('title', 'Topic')
    
    # Try LLM generation first
    llm_mcq = generate_mcq_with_llm(title, content, insights)
    
    if llm_mcq and llm_mcq.get('question') and llm_mcq.get('options'):
        # Use LLM-generated question
        options = llm_mcq['options']
        correct_answer = next((opt['id'] for opt in options if opt.get('isCorrect')), 'A')
        
        return {
            "id": f"q{qid}",
            "question": llm_mcq['question'],
            "options": options,
            "correctAnswer": correct_answer,
            "explanation": llm_mcq.get('explanation', f"Based on the lecture content about {title}"),
            "difficulty": topic.get('importance', 'medium'),
            "conceptsTested": [title],
            "topicId": topic.get('id'),
            "diagnosticFocus": "knowledge_verification"
        }
    
    # Fallback to template-based generation
    sentences = content.split('.')[:3]
    key_fact = sentences[0].strip() if sentences else title
    
    question_text = f"Which statement best describes {title}?"
    
    correct = insights[0] if insights else f"The concept involves {key_fact}"
    
    # Generate plausible wrong answers
    wrong_answers = [
        f"This approach is primarily used in different contexts",
        f"The opposite principle applies in most cases",
        f"There is insufficient evidence to support this theory"
    ]
    
    options = [
        {"id": "A", "text": correct, "isCorrect": True},
        {"id": "B", "text": wrong_answers[0], "isCorrect": False},
        {"id": "C", "text": wrong_answers[1], "isCorrect": False},
        {"id": "D", "text": wrong_answers[2], "isCorrect": False}
    ]
    
    random.shuffle(options)
    
    # Update IDs after shuffle
    for i, opt in enumerate(options):
        opt['id'] = chr(65 + i)  # A, B, C, D
    
    correct_answer = next(opt['id'] for opt in options if opt['isCorrect'])
    
    return {
        "id": f"q{qid}",
        "question": question_text,
        "options": options,
        "correctAnswer": correct_answer,
        "explanation": f"The correct answer relates to: {correct}",
        "difficulty": topic.get('importance', 'medium'),
        "conceptsTested": [title],
        "topicId": topic.get('id'),
        "diagnosticFocus": "knowledge_verification"
    }

# =========================================================
# SAVE FUNCTION
# =========================================================
def save_lecture_plan_to_mock(lecture_plan):
    mock_file_path = Path(r"C:\Users\91901\OneDrive\Desktop\Fork-Automated-Lecture-Summarizer-and-Note-Generator-with-AR-Tutor\frontend\src\app\lib\mock_lecture_plan.json")
    mock_file_path.parent.mkdir(parents=True, exist_ok=True)

    data = []
    if mock_file_path.exists():
        try:
            with open(mock_file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, list):
                    data = [data]
        except:
            data = []

    lecture_plan["generated_at"] = datetime.now().isoformat()
    data.insert(0, lecture_plan)
    data = data[:10]

    with open(mock_file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Saved lecture plan with {lecture_plan['metadata']['totalTopicsGenerated']} topics to: {mock_file_path.resolve()}")
    return str(mock_file_path.resolve())

def save_quiz_results(results_data):
    """Save quiz results to file"""
    results_dir = Path(r"C:\Users\91901\OneDrive\Desktop\Fork-Automated-Lecture-Summarizer-and-Note-Generator-with-AR-Tutor\frontend\src\app\lib\quiz_results")
    results_dir.mkdir(parents=True, exist_ok=True)
    
    results_file = results_dir / "quiz_results.json"
    
    all_results = []
    if results_file.exists():
        try:
            with open(results_file, "r", encoding="utf-8") as f:
                all_results = json.load(f)
                if not isinstance(all_results, list):
                    all_results = [all_results]
        except:
            all_results = []
    
    results_data["saved_at"] = datetime.now().isoformat()
    all_results.insert(0, results_data)
    all_results = all_results[:50]  # Keep last 50 results
    
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)
    
    print(f"Saved quiz results to: {results_file.resolve()}")
    return str(results_file.resolve())

# =========================================================
# API ENDPOINTS
# =========================================================
@app.post("/analyze-lecture")
async def analyze_lecture(
    pdf: Optional[UploadFile] = File(None),
    ppt: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    yt_link: Optional[str] = None
):
    if not pdf and not ppt and not yt_link:
        raise HTTPException(status_code=400, detail="At least one of pdf, ppt, or yt_link must be provided.")

    print("Extracting content...")
    pdf_text = extract_pdf_text(pdf) if pdf else ""
    ppt_text = extract_ppt_text(ppt) if ppt else ""
    transcript = None

    if audio:
        print("Transcribing audio...")
        transcript = transcribe_audio(audio)
    elif yt_link:
        print("Processing YouTube link...")
        transcript = process_yt_link(yt_link)

    print("Analyzing content...")
    analysis = analyze_text(pdf_text, ppt_text, transcript)
    
    print("Generating lecture plan with AI...")
    plan = build_lecture_plan(analysis)

    print("Saving to file...")
    path = save_lecture_plan_to_mock(plan)
    plan["file_saved"] = True
    plan["saved_path"] = path

    return plan

@app.post("/generate-diagnostic-mcq")
async def generate_diagnostic_mcq(request: MCQRequest):
    """Generate diagnostic MCQs from lecture plan"""
    try:
        lecture_plan = request.lecture_plan
        topics = lecture_plan.get('impTopics', [])[:12]
        
        print(f"Generating {request.num_questions} MCQs...")
        
        questions = []
        for i, topic in enumerate(topics):
            if i >= request.num_questions:
                break
            
            print(f"Generating question {i+1}/{request.num_questions}...")
                
            title = topic.get('title', f'Topic {i+1}')
            description = topic.get('description', '')
            full_content = topic.get('full_content', description)
            misconceptions = topic.get('commonMisconceptions', [])
            insights = topic.get('keyInsights', [])
            
            q = create_diagnostic_question(i+1, topic, full_content, misconceptions, insights)
            questions.append(q)
        
        print(f"Generated {len(questions)} questions successfully")
        
        return {
            "success": True,
            "questions": questions,
            "metadata": {
                "generatedAt": datetime.now().isoformat(),
                "totalQuestions": len(questions)
            }
        }
    except Exception as e:
        print(f"Error generating MCQs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-quiz-results")
async def analyze_quiz_results(request: AnswerAnalysisRequest):
    """Analyze quiz results and identify misconceptions"""
    try:
        questions = request.questions
        answers = request.answers
        
        correct = sum(1 for i, ans in enumerate(answers) 
                     if ans.get('selectedAnswer') == questions[i].get('correctAnswer'))
        score = (correct / len(questions)) * 100 if questions else 0
        
        misconceptions = []
        weak_topics = []
        
        for i, (question, answer) in enumerate(zip(questions, answers)):
            if answer.get('selectedAnswer') != question.get('correctAnswer'):
                topic = question.get('conceptsTested', ['Unknown'])[0]
                weak_topics.append(topic)
                
                misconceptions.append({
                    "topic": topic,
                    "question": question.get('question'),
                    "yourAnswer": answer.get('selectedAnswer'),
                    "correctAnswer": question.get('correctAnswer'),
                    "explanation": question.get('explanation', ''),
                    "type": "knowledge_gap"
                })
        
        recommendations = []
        if score < 60:
            recommendations.append("Review fundamental concepts from the lecture")
        if weak_topics:
            recommendations.append(f"Focus on: {', '.join(set(weak_topics[:3]))}")
        if score >= 80:
            recommendations.append("Strong understanding! Move to advanced topics")
        
        return {
            "success": True,
            "score": round(score, 1),
            "correct": correct,
            "total": len(questions),
            "misconceptions": misconceptions,
            "weakTopics": list(set(weak_topics)),
            "recommendations": recommendations,
            "knowledgeState": {
                "overallMastery": score,
                "conceptualUnderstanding": score,
                "needsReview": score < 70
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-quiz-results")
async def save_quiz_results_endpoint(request: SaveResultsRequest):
    """Save quiz results to file"""
    try:
        results_data = {
            "session_id": request.session_id,
            "lecture_id": request.lecture_id,
            "score": request.score,
            "correct": request.correct,
            "total": request.total,
            "questions": request.questions,
            "answers": request.answers,
            "misconceptions": request.misconceptions,
            "weak_topics": request.weak_topics,
            "recommendations": request.recommendations
        }
        
        saved_path = save_quiz_results(results_data)
        
        return {
            "success": True,
            "message": "Quiz results saved successfully",
            "saved_path": saved_path
        }
    except Exception as e:
        print(f"Error saving quiz results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# HEALTH CHECK
# =========================================================
@app.get("/")
async def root():
    return {
        "message": "Study Plan Generator API with MCQ Features",
        "version": "2.0",
        "endpoints": [
            "/analyze-lecture",
            "/generate-diagnostic-mcq",
            "/analyze-quiz-results",
            "/save-quiz-results"
        ]
    }