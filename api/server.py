import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pipeline.slide_analyzer import SlideAnalyzer
from pipeline.context_tracker import TeachingContextTracker
from pipeline.difficulty_classifier import DifficultyClassifier
from pipeline.template_selector import SmartTemplateSelector
from pipeline.script_generator import TeacherScriptGenerator
from pipeline.animation_mapper import AnimationMapper
from pipeline.avatar_formatter import AvatarOutputFormatter
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

avatar_system = None

def get_avatar_system():
    global avatar_system
    if avatar_system is None:
        avatar_system = CompleteTeachingAvatar()
    return avatar_system

class CompleteTeachingAvatar:
    def __init__(self):
        self.analyzer = SlideAnalyzer()
        self.context_tracker = TeachingContextTracker()
        self.difficulty_classifier = DifficultyClassifier()
        self.template_selector = SmartTemplateSelector()
        self.script_generator = TeacherScriptGenerator(
            api_key=os.getenv("OPENAI_API_KEY")
        )
        self.animation_mapper = AnimationMapper()
        self.formatter = AvatarOutputFormatter()
        self.previous_slide_content = None
        self.teaching_history = []
    
    def process_slide(self, slide_content, slide_index):
        analysis = self.analyzer.analyze_slide(slide_content)
        context = self.context_tracker.update_context(slide_content, analysis)
        difficulty = self.difficulty_classifier.classify_difficulty(
            slide_content, self.previous_slide_content
        )
        template_name = self.template_selector.select_template(
            analysis, context, difficulty
        )
        template = self.template_selector.get_template_config(template_name)
        teacher_script = self.script_generator.generate_teacher_script(
            slide_content, template_name, context, difficulty
        )
        avatar_instructions = self.animation_mapper.create_avatar_instructions(
            teacher_script, template_name, template['voice']['pace']
        )
        complete_output = {
            "slide_index": slide_index,
            "original_content": slide_content,
            "analysis": analysis,
            "context": context,
            "difficulty_analysis": difficulty,
            "selected_template": template_name,
            "template_config": template,
            "teacher_script": teacher_script,
            "avatar_instructions": avatar_instructions,
            "total_duration": sum(chunk["duration"] for chunk in avatar_instructions),
            "voice_settings": template['voice'],
            "lip_sync_settings": self.animation_mapper.get_lip_sync_settings(template_name),
            "comprehension_checkpoints": self._extract_checkpoints(teacher_script)
        }
        avatar_package, output_file = self.formatter.format_complete_package(complete_output)
        self.teaching_history.append({
            "slide_index": slide_index,
            "template": template_name,
            "duration": complete_output["total_duration"]
        })
        self.previous_slide_content = slide_content
        return avatar_package
    
    def _extract_checkpoints(self, script):
        checkpoints = []
        sentences = script.split('. ')
        question_indicators = ["does that", "make sense", "understand", "clear", "follow"]
        for i, sentence in enumerate(sentences):
            if any(indicator in sentence.lower() for indicator in question_indicators):
                checkpoints.append({
                    "position": i,
                    "text": sentence,
                    "type": "comprehension_check"
                })
        return checkpoints

@app.get("/")
def root():
    return {"status": "ready", "version": "2.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/process_slide")
def process_slide(request: dict):
    try:
        slide_content = request.get("content", "")
        slide_index = request.get("slide_index", 0)
        
        if not slide_content:
            raise HTTPException(status_code=400, detail="No content provided")
        
        avatar = get_avatar_system()
        result = avatar.process_slide(slide_content, slide_index)
        
        return {
            "success": True,
            "slide_index": slide_index,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process_multiple_slides")
def process_multiple_slides(request: dict):
    try:
        slides = request.get("slides", [])
        results = []
        
        avatar = get_avatar_system()
        
        for i, slide_content in enumerate(slides):
            if isinstance(slide_content, dict):
                content = slide_content.get("content", "")
            else:
                content = str(slide_content)
            
            if content:
                result = avatar.process_slide(content, i)
                results.append(result)
        
        return {
            "success": True,
            "total_slides": len(results),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/session_history")
def get_session_history():
    avatar = get_avatar_system()
    return {
        "teaching_history": avatar.teaching_history,
        "total_slides_processed": len(avatar.teaching_history)
    }

@app.post("/reset_session")
def reset_session():
    global avatar_system
    avatar_system = CompleteTeachingAvatar()
    return {"success": True, "message": "Session reset"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)