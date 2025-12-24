import os
import json
from datetime import datetime
from dotenv import load_dotenv
from pipeline.slide_analyzer import SlideAnalyzer
from pipeline.context_tracker import TeachingContextTracker
from pipeline.difficulty_classifier import DifficultyClassifier
from pipeline.template_selector import SmartTemplateSelector
from pipeline.script_generator import TeacherScriptGenerator
from pipeline.animation_mapper import AnimationMapper
from pipeline.avatar_formatter import AvatarOutputFormatter

class CompleteTeachingAvatar:
    def __init__(self, generate_all_templates=False):
        """
        Args:
            generate_all_templates: If True, creates package with ALL 4 templates
                                   If False, creates package for selected template only
        """
        load_dotenv()
        
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
        self.generate_all_templates = generate_all_templates
        
    def process_slide(self, slide_content, slide_index):
        """Complete teaching pipeline for one slide"""
        
        print(f"\n{'='*60}")
        print(f"TEACHING AVATAR - Processing Slide {slide_index}")
        print(f"{'='*60}")
        
        print("1. Analyzing slide with NLP...")
        analysis = self.analyzer.analyze_slide(slide_content)
        print(f"Topics: {', '.join(analysis.get('main_topics', [])[:3])}")
        print(f"Complexity: {analysis.get('readability_score', 0):.1f} readability")
        
        print("2. Updating teaching context...")
        context = self.context_tracker.update_context(slide_content, analysis)
        print(f"Phase: {context.get('phase', 'unknown')}")
        print(f"Coherence: {context.get('coherence', 0):.2f}")
        
        print("3. Classifying difficulty...")
        difficulty = self.difficulty_classifier.classify_difficulty(
            slide_content, 
            self.previous_slide_content
        )
        print(f"Level: {difficulty.get('difficulty_level', 'unknown')}")
        print(f"Relative: {difficulty.get('relative_difficulty', 'same')}")
        
        print("4. Selecting teaching template...")
        template_name = self.template_selector.select_template(
            analysis, context, difficulty
        )
        template = self.template_selector.get_template_config(template_name)
        print(f"Selected: {template_name}")
        print(f"Pace: {template['voice']['pace']}x")
        
        print("5. Generating teacher script...")
        teacher_script = self.script_generator.generate_teacher_script(
            slide_content, template_name, context, difficulty
        )
        print(f"Script length: {len(teacher_script.split())} words")
        
        print("6. Creating avatar animation sequence...")
        avatar_instructions = self.animation_mapper.create_avatar_instructions(
            teacher_script, template_name, template['voice']['pace']
        )
        print(f"Animation chunks: {len(avatar_instructions)}")
        
        print("7. Formatting for avatar system...")
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
        
        avatar_package, output_file = self.formatter.format_complete_package(
            complete_output, 
            generate_all_templates=self.generate_all_templates
        )
        
        self.teaching_history.append({
            "slide_index": slide_index,
            "template": template_name,
            "duration": complete_output["total_duration"],
            "output_file": output_file
        })
        self.previous_slide_content = slide_content
        
        print(f"\nCOMPLETE! Output saved to: {output_file}")
        print(f"Teaching Template: {template_name}")
        if self.generate_all_templates:
            print("Generated MASTER package with ALL 4 templates")
        else:
            print("Generated SINGLE template package")
        print(f"Total Duration: {complete_output['total_duration']/1000:.1f}s")
        print(f"Voice Pace: {template['voice']['pace']}x")
        print(f"Lip Sync Speed: {self.animation_mapper.get_lip_sync_settings(template_name)['speed_multiplier']}x")
        
        return avatar_package
    
    def _extract_checkpoints(self, script):
        """Extract comprehension checkpoints from script"""
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
    
    def save_teaching_session(self, session_name="teaching_session"):
        """Save complete teaching session history"""
        session_data = {
            "session_name": session_name,
            "timestamp": datetime.now().isoformat(),
            "total_slides": len(self.teaching_history),
            "teaching_history": self.teaching_history,
            "templates_used": list(set([h["template"] for h in self.teaching_history])),
            "generated_all_templates": self.generate_all_templates
        }
        
        output_file = f"outputs/{session_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        os.makedirs("outputs", exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        print(f"\nTeaching session saved to: {output_file}")
        return output_file

def test_avatar_pipeline(generate_all_templates=False):
    """Test the complete avatar pipeline
    
    Args:
        generate_all_templates: If True, creates master package with all 4 templates
                               If False, creates individual template packages
    """
    
    test_slides = [
        "Gradient descent is an optimization algorithm used to minimize functions by iteratively moving in the direction of steepest descent.",
        "Simply put, gradient descent helps models learn from their mistakes by adjusting parameters to reduce errors.",
        "The key insight is that gradient descent doesn't just find any minimum - it finds the optimal minimum efficiently!"
    ]
    
    avatar = CompleteTeachingAvatar(generate_all_templates=generate_all_templates)
    
    print("\n" + "="*60)
    if generate_all_templates:
        print("TEACHING AVATAR PIPELINE TEST - ALL TEMPLATES")
    else:
        print("TEACHING AVATAR PIPELINE TEST - SINGLE TEMPLATE")
    print("="*60 + "\n")
    
    results = []
    for i, slide in enumerate(test_slides):
        print(f"\nProcessing Test Slide {i+1}/{len(test_slides)}")
        print(f"Content: {slide[:80]}...")
        
        result = avatar.process_slide(slide, i)
        results.append(result)
        
        with open(f"outputs/test_slide_{i+1}.json", 'w') as f:
            json.dump(result, f, indent=2)
    
    session_file = avatar.save_teaching_session("test_session")
    
    print(f"\n{'='*60}")
    print("TEST COMPLETE!")
    print(f"Processed {len(results)} slides")
    
    if generate_all_templates:
        print("Generated MASTER package with ALL 4 templates")
        print("Single file contains: patient_explainer, insight_revealer, gradual_builder, clear_lecturer")
    else:
        print("Generated INDIVIDUAL template packages")
    
    print("Check 'outputs/' folder for generated files")
    print(f"Session log: {session_file}")
    print(f"{'='*60}")
    
    return results

if __name__ == "__main__":
    os.makedirs("outputs", exist_ok=True)
    
    generate_master_for_avatar = True  
    
    if generate_master_for_avatar:
        print("\nCONFIGURATION: Generating MASTER package with ALL 4 templates")
        print("   This is for avatar's system")
    else:
        print("\nCONFIGURATION: Generating INDIVIDUAL template packages")
        print("   This is for testing/debugging")
    
    test_avatar_pipeline(generate_all_templates=generate_master_for_avatar)