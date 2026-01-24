import sys
import warnings
warnings.filterwarnings("ignore")

from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uuid
import tempfile
import pdfplumber
import whisper
import os
import requests
import json
from sentence_transformers import SentenceTransformer, util
from datetime import date, datetime
from dotenv import load_dotenv
from pathlib import Path
from pptx import Presentation
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp
import random

# =========================================================
# ENV
# =========================================================
# Load from .env file in the same directory as main.py
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

# =========================================================
# APP INIT
# =========================================================
app = FastAPI(title="Study Plan Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
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

# Validate API key on startup
if not OPENROUTER_API_KEY:
    print("⚠️  WARNING: OPENROUTER_API_KEY not found in environment!")
    print("   Please ensure .env file exists in:", os.path.join(os.path.dirname(__file__), '.env'))
    print("   And contains: OPENROUTER_API_KEY=your_key_here")
else:
    print(f"✅ OpenRouter API Key loaded: {OPENROUTER_API_KEY[:20]}...{OPENROUTER_API_KEY[-4:]}")

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
# API VALIDATION HELPERS
# =========================================================
def validate_api_key():
    """Validate that API key is set and non-empty"""
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY.strip() == "":
        raise Exception(
            "OPENROUTER_API_KEY is not configured. "
            "Please set it in backend/fastapi-service/.env file. "
            "Format: OPENROUTER_API_KEY=sk-or-v1-xxxxx"
        )
    return True

def make_openrouter_request(payload, timeout=15):
    """Make OpenRouter API request with proper error handling"""
    validate_api_key()
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Study Session AI"
    }
    
    try:
        response = requests.post(OPENROUTER_URL, json=payload, headers=headers, timeout=timeout)
        
        if response.status_code == 401:
            raise Exception(
                f"OpenRouter API returned 401 Unauthorized. "
                f"Please verify your API key is correct and active. "
                f"Current key: {OPENROUTER_API_KEY[:20]}..."
            )
        
        response.raise_for_status()
        return response.json()
        
    except requests.exceptions.Timeout:
        raise Exception(f"OpenRouter API request timed out after {timeout}s. Try again.")
    except requests.exceptions.ConnectionError as e:
        raise Exception(f"Cannot connect to OpenRouter API: {str(e)}")

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

    try:
        result = make_openrouter_request(payload)
        title = result["choices"][0]["message"]["content"].strip()
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

    try:
        result = make_openrouter_request(payload)
        return result["choices"][0]["message"]["content"].strip()
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

    try:
        result = make_openrouter_request(payload)
        content = result["choices"][0]["message"]["content"].strip()
        
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
    try:
        results_dir = Path(r"C:\Users\91901\OneDrive\Desktop\Fork-Automated-Lecture-Summarizer-and-Note-Generator-with-AR-Tutor\frontend\src\app\lib\quiz_results")
        results_dir.mkdir(parents=True, exist_ok=True)
        
        results_file = results_dir / "quiz_results.json"
        
        all_results = []
        if results_file.exists():
            try:
                with open(results_file, "r", encoding="utf-8") as f:
                    content = f.read()
                    if content.strip():  # Check if file is not empty
                        all_results = json.loads(content)
                        if not isinstance(all_results, list):
                            all_results = [all_results]
            except json.JSONDecodeError as e:
                print(f"JSON decode error, starting fresh: {e}")
                all_results = []
        
        results_data["saved_at"] = datetime.now().isoformat()
        all_results.insert(0, results_data)
        all_results = all_results[:50]  # Keep last 50 results
        
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
        
        print(f"Saved quiz results to: {results_file.resolve()}")
        return str(results_file.resolve())
    except Exception as e:
        print(f"Error in save_quiz_results: {e}")
        raise

# =========================================================
# AI-POWERED SLIDE GENERATION WITH OPENROUTER
# =========================================================

def generate_slide_with_ai(
    topic: dict,
    action_type: str,
    student_goal: str,
    knowledge_state: dict,
    user_question: str = None,
    context: str = ""
) -> dict:
    """
    Generate complete slide content using AI based on:
    1. Student Goal & Exam
    2. Knowledge State from Quiz Results  
    3. Lecture Plan Content
    """
    
    import json  # Ensure json is available in this scope
    
    knowledge_level = knowledge_state.get('knowledgeLevel', 'intermediate')
    avg_score = knowledge_state.get('averageScore', 0)
    weak_topics = knowledge_state.get('weakTopics', [])
    misconceptions = knowledge_state.get('misconceptions', [])
    
    # Build comprehensive AI prompt
    system_prompt = f"""You are an expert educational content creator specializing in {student_goal.upper()} exam preparation.

Your task is to create engaging, pedagogically sound learning slides that adapt to the student's knowledge level and learning needs.

CRITICAL REQUIREMENTS:
1. Generate content specifically tailored for {student_goal.upper()} exam preparation
2. Adapt complexity based on student's knowledge level: {knowledge_level} (average score: {avg_score}%)
3. Address known weak areas: {', '.join(weak_topics[:3]) if weak_topics else 'None identified yet'}
4. Correct known misconceptions: {len(misconceptions)} identified
5. Include exam-relevant examples, analogies, and real-world applications
6. Provide clear explanations with proper depth for the knowledge level
7. Add memory hooks and learning strategies

RESPONSE FORMAT (JSON):
{{
  "title": "Clear, concise slide title (max 10 words)",
  "narrative": "Engaging 3-4 paragraph explanation with examples and context. Make it conversational and educational.",
  "keyInsights": [
    "4-5 critical points the student must understand",
    "Each insight should be actionable and exam-relevant",
    "Focus on concepts frequently tested in {student_goal.upper()}"
  ],
  "analogies": [
    {{
      "domain": "Relatable real-world domain",
      "comparison": "How this concept is similar to the domain",
      "lesson": "What the student should learn from this analogy"
    }}
  ],
  "realWorldScenario": {{
    "situation": "Practical scenario where this concept applies",
    "application": "How to apply the concept in this scenario",
    "outcome": "Result of proper application"
  }},
  "interactiveElement": "Thought-provoking question to engage the student",
  "examRelevance": "Specific details about how this appears in {student_goal.upper()} exams - question types, weightage, frequency",
  "commonTraps": [
    "3-4 common mistakes students make with this concept",
    "Include misconceptions and wrong approaches"
  ],
  "memoryHook": "Memorable phrase, acronym, or pattern to remember this concept"
}}

ADAPTATION RULES:
- If knowledge_level is 'beginner': Use simple language, more examples, step-by-step breakdowns
- If knowledge_level is 'intermediate': Balance theory with practice, moderate complexity
- If knowledge_level is 'advanced': Include technical depth, edge cases, advanced applications
- If weak_topics mentioned: Provide extra clarity on related concepts
- If misconceptions exist: Explicitly address and correct them

Return ONLY valid JSON, no markdown formatting, no extra text."""

    # Build user prompt based on action type
    if action_type == 'concept_explanation':
        user_prompt = f"""Create an educational slide explaining this concept:

TOPIC: {topic.get('title', 'Unknown Topic')}

TOPIC DETAILS:
Description: {topic.get('description', topic.get('full_content', 'No description available'))[:500]}

Key Insights from Material: {', '.join(topic.get('keyInsights', [])[:3])}
Common Misconceptions: {', '.join(topic.get('commonMisconceptions', [])[:2])}
Real-World Applications: {', '.join(topic.get('realWorldApplications', [])[:2])}
Importance Level: {topic.get('importance', 'medium')}
Difficulty: {topic.get('difficulty', 'medium')}

STUDENT CONTEXT:
- Preparing for: {student_goal.upper()}
- Current knowledge level: {knowledge_level} ({avg_score}% average score)
- Weak areas: {', '.join(weak_topics[:3]) if weak_topics else 'None yet'}
- Recent quiz performance: {"Below expectations" if avg_score < 60 else "Good" if avg_score < 80 else "Excellent"}

Create a comprehensive, engaging slide that helps the student master this concept for their {student_goal.upper()} exam."""

    elif action_type == 'explain-more':
        user_prompt = f"""The student asked for MORE DETAILED explanation of:

TOPIC: {topic.get('title', 'Unknown Topic')}

CONTEXT: They've seen the basic explanation but want deeper insights.

STUDENT PROFILE:
- Knowledge level: {knowledge_level} ({avg_score}% average)
- They're ready for: {"More advanced content" if avg_score >= 70 else "Clearer explanations with more examples"}

Create a DEEPER, MORE DETAILED slide that:
1. Goes beyond surface-level understanding
2. Includes advanced insights and nuances
3. Provides multiple perspectives and approaches
4. Covers edge cases and special scenarios
5. Includes complex examples and applications
6. Addresses subtle points often missed by students

Make this significantly more comprehensive than a basic explanation."""

    elif action_type == 'ask-question':
        user_prompt = f"""The student asked this SPECIFIC QUESTION:

QUESTION: "{user_question}"

ABOUT TOPIC: {topic.get('title', 'Unknown Topic')}

STUDENT CONTEXT:
- Knowledge level: {knowledge_level}
- Current score: {avg_score}%
- Preparing for: {student_goal.upper()}

Create a slide that:
1. DIRECTLY answers their specific question
2. Provides step-by-step explanation
3. Includes concrete examples
4. Shows how to verify the answer
5. Connects to exam patterns in {student_goal.upper()}
6. Addresses related concepts they should know

Focus on making the answer clear, complete, and exam-relevant."""

    elif action_type == 'quiz-results':
        user_prompt = f"""Create a QUIZ PERFORMANCE ANALYSIS slide:

TOPIC TESTED: {topic.get('title', 'Quiz Topic')}

QUIZ CONTEXT: {context}

STUDENT PERFORMANCE:
- Current knowledge level: {knowledge_level}
- Average score: {avg_score}%
- Weak topics identified: {', '.join(weak_topics[:5])}
- Misconceptions found: {len(misconceptions)}

Recent Mistakes:
{chr(10).join([f"- {m.get('concept', 'Unknown')}: {m.get('type', 'Error')}" for m in misconceptions[:3]])}

Create a slide that:
1. Analyzes their performance objectively
2. Identifies specific areas needing improvement
3. Explains WHY they made mistakes (conceptual gaps, misconceptions, etc.)
4. Provides ACTIONABLE recommendations
5. Offers encouragement and learning strategies
6. Maps improvement areas to {student_goal.upper()} exam requirements

Be honest but supportive. Focus on growth opportunities."""

    elif action_type == 'quiz-feedback':
        # Parse context if it's JSON
        context_data = {}
        if context:
            try:
                import json
                context_data = json.loads(context) if isinstance(context, str) else context
            except:
                context_data = {}
        
        wrong_answer = context_data.get('wrongAnswer', {})
        student_performance = context_data.get('studentPerformance', {})
        
        user_prompt = f"""Create a WRONG ANSWER FEEDBACK slide for this quiz mistake:

QUESTION: "{wrong_answer.get('question', 'Unknown question')}"

STUDENT'S ANSWER: "{wrong_answer.get('selectedAnswer', {}).get('text', 'Unknown answer')}"

CORRECT ANSWER: "{wrong_answer.get('correctAnswer', {}).get('text', 'Unknown correct answer')}"

EXPLANATION: "{wrong_answer.get('explanation', 'No explanation available')}"

STUDENT PERFORMANCE:
- Current score: {avg_score}%
- Total wrong answers: {student_performance.get('wrongAnswersCount', 0)}

STUDENT CONTEXT:
- Knowledge level: {knowledge_level}
- Preparing for: {student_goal.upper()}

Create a slide that:
1. Clearly explains WHY the student's answer was wrong
2. Provides the CORRECT answer with detailed explanation
3. Addresses the underlying misconception or knowledge gap
4. Connects to the original slide content they studied
5. Offers strategies to avoid similar mistakes
6. Includes exam-relevant tips for {student_goal.upper()}

Be supportive but clear. Focus on learning from the mistake."""

    else:
        user_prompt = f"""Create an educational slide about: {topic.get('title', 'Topic')}

For {student_goal.upper()} exam preparation at {knowledge_level} level."""

    # Call OpenRouter API
    try:
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 2000
        }

        print(f"Calling AI for {action_type}...")
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        if not result.get("choices") or not result["choices"][0].get("message"):
            raise Exception("Invalid API response format")
            
        content = result["choices"][0]["message"]["content"].strip()
        
        # Clean and parse JSON
        content = content.replace("```json", "").replace("```", "").strip()
        slide_content = json.loads(content)
        
        print(f"AI generated: {slide_content.get('title', 'Untitled')}")
        
        return slide_content
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"⚠️ Model {OPENROUTER_MODEL} not found, using fallback content")
        elif e.response.status_code == 402:
            print(f"⚠️ API payment required, using fallback content")
        else:
            print(f"🚨 HTTP error: {e}")
        raise HTTPException(status_code=500, detail=f"AI model unavailable: {str(e)}")
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        print(f"Raw content: {content[:200]}")
        raise HTTPException(status_code=500, detail=f"AI response parsing failed: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Slide generation error: {str(e)}")


# =========================================================
# API ENDPOINTS
# =========================================================

@app.post("/generate-dynamic-slide")
async def generate_dynamic_slide(
    session_id: str = Body(...),
    lecture_plan: dict = Body(...),
    student_goal: str = Body('gate'),
    knowledge_state: dict = Body({}),
    current_topic_index: int = Body(0),
    action_type: str = Body('concept_explanation'),
    user_question: Optional[str] = Body(None),
    context: Optional[str] = Body('')
):
    """
    Generate dynamic slide with AI using three input streams:
    1. Student Goal & Exam Preference
    2. Knowledge State from Quiz Results
    3. Lecture Plan Content
    """
    try:
        print(f"\n{'='*60}")
        print(f"AI-POWERED SLIDE GENERATION")
        print(f"{'='*60}")
        print(f"Action: {action_type}")
        print(f"Goal: {student_goal.upper()}")
        print(f"Topic Index: {current_topic_index}")
        print(f"Knowledge Level: {knowledge_state.get('knowledgeLevel', 'intermediate')}")
        if user_question:
            print(f"Question: {user_question[:50]}...")
        print(f"{'='*60}\n")

        # Extract current topic
        topics = lecture_plan.get('impTopics', [])
        
        if not topics:
            raise HTTPException(status_code=400, detail="Lecture plan has no topics")

        if current_topic_index < 0 or current_topic_index >= len(topics):
            # Instead of defaulting silently, raise error or use first topic intentionally
            raise HTTPException(status_code=400, detail=f"Invalid topic index: {current_topic_index}")

        current_topic = topics[current_topic_index]

        print("DEBUG: Generating slide for topic:", current_topic.get('title'))

        
        # Generate slide content with AI
        slide_content = generate_slide_with_ai(
            topic=current_topic,
            action_type=action_type,
            student_goal=student_goal,
            knowledge_state=knowledge_state,
            user_question=user_question,
            context=context
        )
        
        # Get relevant images from Wikimedia
        images = await get_wikimedia_images(current_topic, action_type)
        
        # Create complete slide object
        slide = {
            "id": f"slide_{int(datetime.now().timestamp()*1000)}",
            "title": slide_content.get('title', current_topic.get('title', 'Learning Slide')),
            "type": action_type,
            "content": slide_content,
            "images": images,
            "metadata": {
                "generatedAt": datetime.now().isoformat(),
                "sessionId": session_id,
                "topicIndex": current_topic_index,
                "topicTitle": current_topic.get('title', ''),
                "studentGoal": student_goal,
                "knowledgeLevel": knowledge_state.get('knowledgeLevel', 'intermediate'),
                "actionType": action_type,
                "hasImages": len(images) > 0,
                "generatedBy": "AI",
                "aiModel": OPENROUTER_MODEL
            }
        }
        
        print(f"   Complete slide generated:")
        print(f"   Title: {slide['title']}")
        print(f"   Images: {len(images)}")
        print(f"   Type: {action_type}")
        print(f"   AI Model: {OPENROUTER_MODEL}\n")
        
        return {
            "success": True,
            "slide": slide,
            "message": f"AI-generated slide for {action_type}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in slide generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


async def get_wikimedia_images(topic: dict, action_type: str) -> list:
    """Get relevant images from image server (Wikimedia)"""
    try:
        title = topic.get('title', 'concept')
        
        # Build intelligent search query
        search_terms = [title]
        
        # Add context based on action type
        if action_type == 'concept_explanation':
            search_terms.append('diagram')
        elif action_type == 'explain-more':
            search_terms.append('detailed illustration')
        elif action_type == 'ask-question':
            search_terms.append('explanation')
        
        search_query = ' '.join(search_terms)
        
        print(f"Searching images: {search_query}")
        
        # Call image server
        response = requests.get(
            "http://localhost:8002/search_image",
            params={"query": search_query},
            timeout=8
        )
        
        if response.ok:
            data = response.json()
            image_url = data.get('image_url', '')
            
            # Check if real image (not placeholder)
            if image_url and 'placeholder' not in image_url.lower():
                print(f"Found Wikimedia image")
                return [{
                    "id": f"img_{int(datetime.now().timestamp()*1000)}",
                    "url": image_url,
                    "caption": f"Visual representation: {title}",
                    "alt": f"Educational diagram for {title}",
                    "source": "wikimedia",
                    "isPlaceholder": False
                }]
        
        print(f"No Wikimedia image found, using placeholder")
        
    except Exception as e:
        print(f"Image fetch error: {e}")
    
    # Fallback placeholder
    from urllib.parse import quote
    return [{
        "id": f"placeholder_{int(datetime.now().timestamp()*1000)}",
        "url": f"https://via.placeholder.com/800x500/3b82f6/ffffff?text={quote(topic.get('title', 'Concept')[:30])}",
        "caption": f"Concept: {topic.get('title', 'Topic')}",
        "alt": "Educational concept",
        "source": "placeholder",
        "isPlaceholder": True
    }]

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
        topics = lecture_plan.get('impTopics', [])
        num_questions = request.num_questions
        
        if not topics:
            raise HTTPException(status_code=400, detail="No topics found in lecture plan")
        
        print(f"Generating {num_questions} MCQs from {len(topics)} topics...")
        
        questions = []
        questions_per_topic = max(1, num_questions // len(topics))
        
        # Generate multiple questions per topic if needed
        for topic_idx, topic in enumerate(topics):
            # Calculate how many questions to generate from this topic
            if len(questions) >= num_questions:
                break
            
            # Generate 1-2 questions per topic depending on need
            num_from_this_topic = min(
                questions_per_topic + (1 if len(questions) < num_questions - len(topics) + topic_idx else 0),
                num_questions - len(questions)
            )
            
            for q_num in range(num_from_this_topic):
                if len(questions) >= num_questions:
                    break
                
                q_id = len(questions) + 1
                print(f"Generating question {q_id}/{num_questions} from topic: {topic.get('title', 'Unknown')[:50]}...")
                
                title = topic.get('title', f'Topic {topic_idx+1}')
                description = topic.get('description', '')
                full_content = topic.get('full_content', description)
                misconceptions = topic.get('commonMisconceptions', [])
                insights = topic.get('keyInsights', [])
                
                q = create_diagnostic_question(q_id, topic, full_content, misconceptions, insights)
                questions.append(q)
        
        print(f"Generated {len(questions)} questions successfully")
        
        return {
            "success": True,
            "questions": questions,
            "metadata": {
                "generatedAt": datetime.now().isoformat(),
                "totalQuestions": len(questions),
                "topicsUsed": len(topics)
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
        print(f"Received quiz results: session={request.session_id}, score={request.score}")
        
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
            "recommendations": request.recommendations,
            "timestamp": datetime.now().isoformat()
        }
        
        saved_path = save_quiz_results(results_data)
        
        print(f"Successfully saved quiz results to: {saved_path}")
        
        return {
            "success": True,
            "message": "Quiz results saved successfully",
            "saved_path": saved_path,
            "session_id": request.session_id
        }
    except Exception as e:
        error_msg = str(e)
        print(f"Error saving quiz results: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to save results: {error_msg}")

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

@app.get("/get-lecture-plan")
async def get_lecture_plan(
    sessionId: Optional[str] = None,
    latest: Optional[bool] = False
):
    """Get lecture plan - always returns latest if sessionId not found"""
    try:
        mock_file_path = Path(r"C:\Users\91901\OneDrive\Desktop\Fork-Automated-Lecture-Summarizer-and-Note-Generator-with-AR-Tutor\frontend\src\app\lib\mock_lecture_plan.json")
        
        if not mock_file_path.exists():
            raise HTTPException(status_code=404, detail="No lecture plans found")
        
        with open(mock_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
            # Ensure data is a list
            if not isinstance(data, list):
                data = [data]
            
            if not data:
                raise HTTPException(status_code=404, detail="No lecture plans available")
            
            # If sessionId provided, try to find it, but fallback to latest
            if sessionId:
                for plan in data:
                    if plan.get('sessionId') == sessionId:
                        print(f"Found lecture plan with sessionId: {sessionId}")
                        return plan
                
                # SessionId not found - return latest instead of 404
                print(f"SessionId {sessionId} not found, returning latest plan")
                return data[0]
            
            # Otherwise return latest (first in list)
            print(f"Returning latest lecture plan")
            return data[0]
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting lecture plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# SERVER STARTUP
# =========================================================
if __name__ == "__main__":
    import uvicorn
    print("="*60)
    print("Starting Study Plan Generator API")
    print("="*60)
    print("Endpoints:")
    print("  - POST /analyze-lecture")
    print("  - POST /generate-diagnostic-mcq")
    print("  - POST /analyze-quiz-results")
    print("  - POST /save-quiz-results")
    print("="*60)
    print("Server running at: http://localhost:8001")
    print("API docs: http://localhost:8001/docs")
    print("="*60)
    
    uvicorn.run(app, host="0.0.0.0", port=8001)