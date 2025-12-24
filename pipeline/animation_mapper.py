import json

class AnimationMapper:
    def __init__(self):
        self.template_animations = {
            "patient_explainer": {
                "facial_expression": "gentle_smile",
                "head_movement": "slow_nods",
                "eye_behavior": "soft_focus",
                "lip_sync": "clear_slow" 
            },
            "insight_revealer": {
                "facial_expression": "surprised_emphasis",
                "head_movement": "emphatic_nods",
                "eye_behavior": "wide_engaging",
                "lip_sync": "emphatic_clear"
            },
            "gradual_builder": {
                "facial_expression": "focused_neutral",
                "head_movement": "methodical_nods",
                "eye_behavior": "sequential_focus",
                "lip_sync": "precise_clear"
            },
            "clear_lecturer": {
                "facial_expression": "neutral_professional",
                "head_movement": "subtle_nods",
                "eye_behavior": "direct_engagement",
                "lip_sync": "normal_clear"
            }
        }
    
    def create_avatar_instructions(self, script, template, pace):
        sentences = [s.strip() for s in script.split('. ') if s.strip()]
        
        instructions = []
        current_time = 0
        
        for i, sentence in enumerate(sentences):
            word_count = len(sentence.split())
            base_duration = (word_count / 150) * 60 * 1000  
            duration = base_duration / pace  
            
            anim_settings = self.template_animations[template]
            
            chunk = {
                "text": sentence + ".",
                "start_time": current_time,
                "duration": int(duration),
                "voice": {
                    "pace_multiplier": pace,
                    "tone": template,
                    "pauses": self._calculate_pauses(sentence, template)
                },
                "avatar_animation": {
                    "facial": anim_settings["facial_expression"],
                    "head": anim_settings["head_movement"],
                    "eyes": anim_settings["eye_behavior"],
                    "lip_sync_mode": anim_settings["lip_sync"]
                }
            }
            
            instructions.append(chunk)
            current_time += duration
        
        return instructions
    
    def _calculate_pauses(self, sentence, template):
        pauses = []
        words = sentence.split()
        
        if template == "patient_explainer":
            pause_every = 8
            pause_duration = 600
        elif template == "insight_revealer":
            pause_every = 12
            pause_duration = 800
        else:
            pause_every = 10
            pause_duration = 400
        
        for i in range(pause_every, len(words), pause_every):
            pauses.append({
                "after_word": i,
                "duration": pause_duration
            })
        
        return pauses
    
    def get_lip_sync_settings(self, template):
        lip_sync_profiles = {
            "patient_explainer": {
                "exaggeration_level": 1.2,
                "mouth_shapes": "clear_rounded",
                "speed_multiplier": 0.8
            },
            "insight_revealer": {
                "exaggeration_level": 1.5,
                "mouth_shapes": "emphatic_open",
                "speed_multiplier": 1.0
            },
            "gradual_builder": {
                "exaggeration_level": 1.0,
                "mouth_shapes": "precise_consonants",
                "speed_multiplier": 0.9
            },
            "clear_lecturer": {
                "exaggeration_level": 1.0,
                "mouth_shapes": "natural_speech",
                "speed_multiplier": 1.0
            }
        }
        return lip_sync_profiles.get(template, {"exaggeration_level": 1.0, "mouth_shapes": "natural", "speed_multiplier": 1.0})