class SmartTemplateSelector:
    def __init__(self):
        self.templates = {
            "patient_explainer": {
                "voice": {
                    "pace": 0.65,
                    "tone": "warm_reassuring",
                    "pitch_variation": "low",
                    "emphasis": "on_analogies"
                },
                "script_style": {
                    "opening": ["I know this can be tricky...", "Let's take this slowly..."],
                    "closing": ["Take your time with this.", "Does that make sense?"]
                },
                "content_strategy": "simplify_with_examples"
            },
            
            "insight_revealer": {
                "voice": {
                    "pace": 0.9,
                    "tone": "excited_emphatic",
                    "pitch_variation": "high",
                    "emphasis": "on_key_terms"
                },
                "script_style": {
                    "opening": ["Here's something important...", "Now this is key..."],
                    "closing": ["Remember this point!", "This is crucial!"]
                },
                "content_strategy": "dramatic_reveal"
            },
            
            "gradual_builder": {
                "voice": {
                    "pace": 0.8,
                    "tone": "confident_steady",
                    "pitch_variation": "medium",
                    "emphasis": "on_steps"
                },
                "script_style": {
                    "opening": ["Let's build this step by step...", "Starting with..."],
                    "closing": ["And that completes the process.", "Step by step, we got there."]
                },
                "content_strategy": "sequential_explanation"
            },
            
            "clear_lecturer": {
                "voice": {
                    "pace": 1.0,
                    "tone": "professional_clear",
                    "pitch_variation": "normal",
                    "emphasis": "on_definitions"
                },
                "script_style": {
                    "opening": ["Next, we have...", "Moving on to..."],
                    "closing": ["That covers the concept.", "Let's continue."]
                },
                "content_strategy": "direct_explanation"
            }
        }
    
    def select_template(self, analysis, context, difficulty):
        """Select teaching template based on analysis"""
        
        intent_signals = analysis.get("intent_signals", {})
        has_question = analysis.get("question_presence", False)
        
        if intent_signals.get("simplify") or intent_signals.get("clarify"):
            return "patient_explainer"
        
        elif intent_signals.get("emphasize") or has_question:
            return "insight_revealer"
        
        elif difficulty.get("relative_difficulty") in ["harder", "much_harder"]:
            return "gradual_builder"
        
        elif context.get("phase") == "deep_dive":
            return "gradual_builder"
        
        elif analysis.get("readability_score", 0) < 50: 
            return "patient_explainer"
        else:
            return "clear_lecturer"
    
    def get_template_config(self, template_name):
        """Get configuration for a specific template"""
        return self.templates.get(template_name, self.templates["clear_lecturer"])