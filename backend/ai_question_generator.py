from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
from pathlib import Path
import requests
import random

app = FastAPI()

class QuestionRequest(BaseModel):
    lecturePlan: Dict[str, Any]
    questionCount: int = 10
    questionTypes: Optional[List[str]] = None

class Question(BaseModel):
    id: int
    type: str
    topicId: str
    topicName: str
    question: str
    options: List[Dict[str, Any]]
    explanation: str
    difficulty: str
    weightage: float
    assessedSkill: str

class QuestionResponse(BaseModel):
    success: bool
    questions: List[Question]
    message: str

# AI Question Generation Templates
QUESTION_TEMPLATES = {
    "conceptual": [
        "What is the fundamental concept behind {topic}?",
        "Which statement best describes the core principle of {topic}?",
        "What is the main purpose of {topic} in this context?",
        "How would you define {topic} based on the content studied?"
    ],
    "application": [
        "Which of the following represents a practical application of {topic}?",
        "How is {topic} applied in real-world scenarios?",
        "In which situation would {topic} be most effectively used?",
        "What is a specific implementation of {topic} mentioned in the content?"
    ],
    "misconception": [
        "Which of the following represents a common misconception about {topic}?",
        "What do students often misunderstand about {topic}?",
        "Which statement is false regarding {topic}?",
        "What is an incorrect assumption people make about {topic}?"
    ],
    "definition": [
        "Which statement provides the most accurate definition of {topic}?",
        "What is the formal definition of {topic} based on the content?",
        "How would you properly define {topic}?",
        "Which description correctly captures the essence of {topic}?"
    ],
    "analysis": [
        "Which statement correctly analyzes the key aspects of {topic}?",
        "What are the critical components of {topic}?",
        "How does {topic} compare to alternative approaches?",
        "What are the main advantages of {topic}?"
    ],
    "practical": [
        "Which approach would be most effective for implementing {topic}?",
        "What is the best practice for working with {topic}?",
        "How would you practically apply {topic} in a project?",
        "Which method is recommended for using {topic}?"
    ],
    "evaluation": [
        "Which criterion is most important for evaluating {topic}?",
        "How would you assess the effectiveness of {topic}?",
        "What factor determines the success of {topic}?",
        "Which standard should be used to measure {topic}?"
    ]
}

SKILL_MAPPINGS = {
    "conceptual": "conceptual_understanding",
    "application": "practical_application", 
    "misconception": "misconception_identification",
    "definition": "definitional_knowledge",
    "analysis": "analytical_thinking",
    "practical": "practical_reasoning",
    "evaluation": "evaluative_judgment"
}

def generate_ai_question(lecture_plan: dict, question_count: int = 10, question_types: list = None):
    """Generate AI-powered questions from lecture plan"""
    if not lecture_plan or not lecture_plan.get('impTopics'):
        return []
    
    topics = lecture_plan['impTopics']
    all_questions = []
    
    # Generate simple content-based questions from each topic
    for topic_data in topics:
        if len(all_questions) >= question_count:
            break
            
        # Generate simple factual questions from this topic
        simple_questions = generate_simple_content_questions(topic_data)
        all_questions.extend(simple_questions)
    
    # If we still need more questions, generate some basic ones
    if len(all_questions) < question_count:
        for topic_data in topics:
            if len(all_questions) >= question_count:
                break
                
            # Generate a basic question about the topic
            basic_question = {
                "id": f"basic_{topic_data.get('id', 'unknown')}_{len(all_questions)}",
                "type": "basic",
                "topicId": topic_data.get('id', ''),
                "topicName": topic_data.get('title', ''),
                "question": f"What is the main focus of {topic_data.get('title', 'this topic')}?",
                "options": [
                    {"id": "a", "text": f"The main focus is on {topic_data.get('title', 'the core concepts')} as described in the content.", "isCorrect": True},
                    {"id": "b", "text": f"The content does not provide a clear focus for {topic_data.get('title', 'this topic')}.", "isCorrect": False},
                    {"id": "c", "text": f"The main focus is completely different from what is described in the content.", "isCorrect": False},
                    {"id": "d", "text": f"There is no main focus mentioned in the content about {topic_data.get('title', 'this topic')}.", "isCorrect": False}
                ],
                "explanation": f"The content clearly focuses on {topic_data.get('title', 'the topic')} as the main subject.",
                "difficulty": topic_data.get('difficulty', 'medium'),
                "assessedSkill": "basic_understanding"
            }
            all_questions.append(basic_question)
    
    # Shuffle and return the requested number of questions
    random.shuffle(all_questions)
    return all_questions[:question_count]

def extract_correct_answer(topic_data, question_type):
    """Extract correct answer from topic content"""
    topic = topic_data.get('title', '')
    full_text = topic_data.get('full_text', '')
    key_insights = topic_data.get('key_insights', [])
    applications = topic_data.get('real_world_applications', [])
    
    if question_type == "conceptual":
        # Use key insights for conceptual questions
        if key_insights and len(key_insights) > 0:
            insight = key_insights[0]
            # Clean up the insight and make it a proper answer
            if len(insight) > 20:
                return insight.replace('Understanding ', '').replace('The principles of ', '').replace('Practical application of ', '').strip()
        return f"The fundamental concept of {topic} involves understanding its core principles and practical applications."
    
    elif question_type == "application":
        # Use real-world applications
        if applications and len(applications) > 0:
            app = applications[0]
            if len(app) > 20:
                return app.strip()
        return f"Using {topic} to solve real-world problems efficiently and effectively."
    
    elif question_type == "misconception":
        # Use common misconceptions
        misconceptions = topic_data.get('common_misconceptions', [])
        if misconceptions and len(misconceptions) > 0:
            misconception = misconceptions[0]
            if len(misconception) > 20 and 'Important concept' not in misconception:
                return misconception.strip()
        return f"A common misconception about {topic} is that it works the same in all situations."
    
    elif question_type == "definition":
        # Extract definition from full text
        if full_text and len(full_text) > 30:
            sentences = full_text.split('. ')
            for sentence in sentences:
                if 'is' in sentence or 'refers to' in sentence or 'are' in sentence:
                    clean_sentence = sentence.strip()
                    if len(clean_sentence) > 20 and len(clean_sentence) < 200:
                        return clean_sentence + '.'
        return f"{topic} is a fundamental concept that involves specific principles and applications in computer science."
    
    else:
        # For analysis, practical, evaluation questions
        return f"The most effective approach to {topic} involves understanding its principles and applying them appropriately."

def generate_distractors(correct_answer, topic_data, question_type):
    """Generate plausible, specific distractors"""
    topic = topic_data.get('title', '')
    full_text = topic_data.get('full_text', '')
    
    if question_type == "conceptual":
        distractors = [
            f"{topic} is only about theoretical concepts without practical applications.",
            f"The main purpose of {topic} is to complicate simple problems.",
            f"{topic} can be understood without studying its fundamental principles."
        ]
    
    elif question_type == "application":
        distractors = [
            f"{topic} cannot be used in real-world scenarios.",
            f"The only application of {topic} is in academic exercises.",
            f"{topic} requires specialized equipment that is not widely available."
        ]
    
    elif question_type == "misconception":
        distractors = [
            f"{topic} works exactly the same way in all situations.",
            f"There are no common misunderstandings about {topic}.",
            f"All students naturally understand {topic} without any confusion."
        ]
    
    elif question_type == "definition":
        distractors = [
            f"{topic} is a collection of unrelated concepts.",
            f"{topic} refers only to mathematical formulas.",
            f"{topic} is a programming language used for web development."
        ]
    
    else:
        distractors = [
            f"The least important aspect of {topic} is theoretical understanding.",
            f"{topic} should be implemented without any planning or analysis.",
            f"The effectiveness of {topic} cannot be measured or evaluated."
        ]
    
    return distractors[:3]  # Return 3 distractors

def generate_simple_content_questions(topic_data):
    """Generate very simple, direct test questions from content"""
    topic = topic_data.get('title', '')
    full_text = topic_data.get('full_text', '')
    key_insights = topic_data.get('key_insights', [])
    applications = topic_data.get('real_world_applications', [])
    
    questions = []
    
    # Generate 1-2 simple factual questions from the content
    if full_text and len(full_text) > 50:
        # Extract key facts from the content
        sentences = full_text.split('. ')
        factual_sentences = [s.strip() for s in sentences if len(s.strip()) > 15 and len(s.strip()) < 100]
        
        for i, sentence in enumerate(factual_sentences[:2]):
            if i >= 2:  # Limit to 2 questions per topic
                break
                
            # Clean up the sentence and make it a proper statement
            clean_sentence = sentence.replace('MM :: FF FF IICCRROOOORRGGAANNIISSMMSS', '').replace('RRIIEENNDD AANNDD', '').strip()
            
            if len(clean_sentence) > 20 and 'is' in clean_sentence or 'are' in clean_sentence:
                # Create a simple question from the fact
                question_text = f"According to the content, {clean_sentence}?"
                
                # Use the sentence as correct answer
                correct_answer = clean_sentence
                
                # Generate simple distractors
                distractors = [
                    "This information is not mentioned in the content.",
                    "The content states the opposite of this information.",
                    "This is a partial but incomplete understanding."
                ]
                
                questions.append({
                    "id": f"simple_{topic_data.get('id', 'unknown')}_{i}",
                    "type": "factual",
                    "topicId": topic_data.get('id', ''),
                    "topicName": topic,
                    "question": question_text,
                    "options": [
                        {"id": "a", "text": correct_answer, "isCorrect": True},
                        {"id": "b", "text": distractors[0], "isCorrect": False},
                        {"id": "c", "text": distractors[1], "isCorrect": False},
                        {"id": "d", "text": distractors[2], "isCorrect": False}
                    ],
                    "explanation": f"This information is directly stated in the content.",
                    "difficulty": topic_data.get('difficulty', 'medium'),
                    "assessedSkill": "factual_recall"
                })
    
    # Generate one question from key insights if available
    if key_insights and len(key_insights) > 0 and len(questions) < 2:
        insight = key_insights[0]
        if len(insight) > 15 and 'Important concept' not in insight:
            question_text = f"What is the key insight mentioned in the content?"
            
            distractors = [
                "The content does not provide any insights.",
                "The main insight is that the topic is too complex.",
                "There are no key insights in the content."
            ]
            
            questions.append({
                "id": f"insight_{topic_data.get('id', 'unknown')}",
                "type": "insight",
                "topicId": topic_data.get('id', ''),
                "topicName": topic,
                "question": question_text,
                "options": [
                    {"id": "a", "text": insight.strip(), "isCorrect": True},
                    {"id": "b", "text": distractors[0], "isCorrect": False},
                    {"id": "c", "text": distractors[1], "isCorrect": False},
                    {"id": "d", "text": distractors[2], "isCorrect": False}
                ],
                "explanation": f"This is explicitly mentioned as a key insight in the content.",
                "difficulty": topic_data.get('difficulty', 'medium'),
                "assessedSkill": "insight_understanding"
            })
    
    # Generate one simple definition question
    if len(questions) < 2 and full_text:
        question_text = f"What is {topic} according to the content?"
        
        # Extract a simple definition from the content
        sentences = full_text.split('. ')
        definition_sentence = ""
        for sentence in sentences[:5]:  # Check first 5 sentences
            clean_sentence = sentence.replace('MM :: FF FF IICCRROOOORRGGAANNIISSMMSS', '').replace('RRIIEENNDD AANNDD', '').strip()
            if len(clean_sentence) > 20 and ('is' in clean_sentence or 'are' in clean_sentence or 'refer' in clean_sentence):
                definition_sentence = clean_sentence
                break
        
        if definition_sentence:
            distractors = [
                f"{topic} is not defined in the content.",
                f"{topic} is only about theoretical concepts.",
                f"{topic} refers to mathematical formulas only."
            ]
            
            questions.append({
                "id": f"definition_{topic_data.get('id', 'unknown')}",
                "type": "definition",
                "topicId": topic_data.get('id', ''),
                "topicName": topic,
                "question": question_text,
                "options": [
                    {"id": "a", "text": definition_sentence, "isCorrect": True},
                    {"id": "b", "text": distractors[0], "isCorrect": False},
                    {"id": "c", "text": distractors[1], "isCorrect": False},
                    {"id": "d", "text": distractors[2], "isCorrect": False}
                ],
                "explanation": f"This definition is provided in the content about {topic}.",
                "difficulty": topic_data.get('difficulty', 'medium'),
                "assessedSkill": "definitional_knowledge"
            })
    
    return questions

def generate_explanation(topic_data, question_type, correct_answer):
    """Generate explanation for the correct answer"""
    topic = topic_data.get('title', '')
    
    if question_type == "conceptual":
        return f"The correct answer captures the fundamental concept of {topic}. Understanding this core principle is essential for proper application."
    
    elif question_type == "application":
        return f"This scenario demonstrates the practical application of {topic} in a real-world context, showing how the concept is used effectively."
    
    elif question_type == "misconception":
        return f"This is a common misunderstanding about {topic}. The correct approach involves understanding the actual principles and avoiding this misconception."
    
    elif question_type == "definition":
        return f"The correct definition of {topic} encompasses its core principles, characteristics, and applications in the field."
    
    else:
        return f"This answer represents the most effective approach to {topic}, considering best practices and optimal outcomes."

def determine_difficulty(topic_data, question_type):
    """Determine question difficulty based on topic and question type"""
    importance = topic_data.get('importance', 'medium')
    difficulty_map = {
        'high': {'conceptual': 'medium', 'application': 'hard', 'misconception': 'hard'},
        'medium': {'conceptual': 'easy', 'application': 'medium', 'misconception': 'medium'},
        'low': {'conceptual': 'easy', 'application': 'easy', 'misconception': 'easy'}
    }
    
    return difficulty_map.get(importance, {}).get(question_type, 'medium')

@app.post("/api/generate-ai-questions", response_model=QuestionResponse)
async def generate_ai_questions(request: QuestionRequest):
    """Generate AI-powered questions from lecture plan"""
    try:
        lecture_plan = request.lecturePlan
        question_count = request.questionCount
        question_types = request.questionTypes or ["conceptual", "application", "misconception", "definition", "analysis"]
        
        if not lecture_plan or 'impTopics' not in lecture_plan:
            raise HTTPException(status_code=400, detail="Invalid lecture plan provided")
        
        topics = lecture_plan['impTopics']
        if not topics:
            raise HTTPException(status_code=400, detail="No topics found in lecture plan")
        
        # Generate questions using the new simple approach
        raw_questions = generate_ai_question(lecture_plan, question_count, question_types)
        
        # Convert to Question objects
        questions = []
        for i, q in enumerate(raw_questions):
            question = Question(
                id=i + 1,
                type=q.get('type', 'factual'),
                topicId=q.get('topicId', ''),
                topicName=q.get('topicName', ''),
                question=q.get('question', ''),
                options=q.get('options', []),
                explanation=q.get('explanation', ''),
                difficulty=q.get('difficulty', 'medium'),
                weightage=10.0,
                assessedSkill=q.get('assessedSkill', 'factual_recall')
            )
            questions.append(question)
        
        # Take only the requested number of questions
        questions = questions[:question_count]
        
        return QuestionResponse(
            success=True,
            questions=questions,
            message=f"Successfully generated {len(questions)} simple content-based questions"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "AI Question Generator"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
