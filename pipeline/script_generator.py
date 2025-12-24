import openai
from openai import OpenAI
import json

class TeacherScriptGenerator:
    def __init__(self, api_key):
        self.client = OpenAI(api_key=api_key)
        
    def generate_teacher_script(self, slide_content, template, context, difficulty):
        """Generate natural teacher explanation using OpenAI"""
        
        prompt = self._create_teaching_prompt(
            slide_content, template, context, difficulty
        )
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert AI teaching assistant. Explain technical concepts naturally like a human teacher."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            script = response.choices[0].message.content
            
            return self._add_teaching_elements(script, template)
            
        except Exception as e:
            print(f"OpenAI API error: {e}")
            return self._generate_fallback_script(slide_content, template)
    
    def _create_teaching_prompt(self, content, template, context, difficulty):
        """Create detailed prompt for OpenAI"""
        
        prompt = f"""
        TASK: Transform this academic slide content into a natural teacher explanation.
        
        SLIDE CONTENT: {content}
        
        TEACHING CONTEXT:
        - Template: {template}
        - Teaching Phase: {context['phase']}
        - Difficulty Level: {difficulty['difficulty_level']}
        - Relative Difficulty: {difficulty['relative_difficulty']}
        
        TEACHING INSTRUCTIONS:
        """
        
        if template == "patient_explainer":
            prompt += """
            1. Start with empathy: "I know this can be confusing..."
            2. Use simple analogies and everyday examples
            3. Speak slowly with clear explanations
            4. Check for understanding: "Does that make sense?"
            5. End with encouragement
            """
        elif template == "insight_revealer":
            prompt += """
            1. Build up to the key insight dramatically
            2. Use emphasis and repetition for important points
            3. Connect to bigger picture
            4. Make it memorable with metaphors
            5. End with impact
            """
        elif template == "gradual_builder":
            prompt += """
            1. Explain step by step
            2. Use "first", "then", "finally"
            3. Make connections between steps
            4. Keep it structured and clear
            """
        else:  # clear_lecturer
            prompt += """
            1. Explain clearly and professionally
            2. Use precise terminology
            3. Structure the explanation logically
            4. Maintain academic tone
            """
        
        prompt += "\n\nGenerate the teacher's spoken explanation (just the speech, no markdown):"
        
        return prompt
    
    def _add_teaching_elements(self, script, template):
        """Add template-specific elements to script"""
        if template == "patient_explainer":
            if not script.startswith(("I know", "Let me", "This can be")):
                script = "I know this can be confusing. " + script
            if "?" not in script:
                script += " Does that make sense?"
        elif template == "insight_revealer":
            if not script.startswith(("Here's", "The key", "Important")):
                script = "Here's something important: " + script
        elif template == "gradual_builder":
            if not script.startswith(("Let's", "First", "Step")):
                script = "Let's break this down step by step. " + script
        
        return script
    
    def _generate_fallback_script(self, slide_content, template):
        """Generate fallback script when OpenAI fails"""
        print("Using fallback script generator...")
        
        if template == "patient_explainer":
            return f"I know this can be confusing. Let me explain it simply: {slide_content}"
        elif template == "insight_revealer":
            return f"Here's something important: {slide_content}"
        elif template == "gradual_builder":
            return f"Let's build this step by step. First, {slide_content}"
        else:  # clear_lecturer
            return f"Next, we have: {slide_content}"