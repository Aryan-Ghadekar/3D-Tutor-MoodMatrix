import json
from datetime import datetime
import os

class AvatarOutputFormatter:
    def __init__(self):
        self.lip_sync_profiles = {
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
        
        self.facial_expressions = {
            "patient_explainer": "empathetic_smile",
            "insight_revealer": "excited_surprise",
            "gradual_builder": "focused_concentration",
            "clear_lecturer": "neutral_professional"
        }
        
        self.head_movements = {
            "patient_explainer": "slow_nods",
            "insight_revealer": "emphatic_nods",
            "gradual_builder": "methodical_nods",
            "clear_lecturer": "subtle_nods"
        }
        
        self.eye_behaviors = {
            "patient_explainer": "soft_focus",
            "insight_revealer": "direct_engaging",
            "gradual_builder": "sequential_focus",
            "clear_lecturer": "neutral_engagement"
        }
        
        self.voice_profiles = {
            "patient_explainer": {"pace": 0.8, "tone": "calm", "pitch_variation": 0.3},
            "insight_revealer": {"pace": 1.2, "tone": "excited", "pitch_variation": 0.6},
            "gradual_builder": {"pace": 1.0, "tone": "methodical", "pitch_variation": 0.4},
            "clear_lecturer": {"pace": 1.1, "tone": "authoritative", "pitch_variation": 0.5}
        }
    
    def format_complete_package(self, pipeline_output, generate_all_templates=False):
        if generate_all_templates:
            return self._format_multi_template_package(pipeline_output)
        else:
            return self._format_single_template_package(pipeline_output)
    
    def _format_single_template_package(self, pipeline_output):
        template = pipeline_output.get("selected_template", "patient_explainer")
        
        package = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "slide_index": pipeline_output.get("slide_index", 0),
                "total_duration": pipeline_output.get("total_duration", 0),
                "teaching_template": template,
                "chunk_count": len(pipeline_output.get("avatar_instructions", []))
            },
            "avatar_instructions": {
                "voice_settings": self.voice_profiles[template],
                "lip_sync": self.lip_sync_profiles[template],
                "facial_animation": {
                    "base_expression": self.facial_expressions[template],
                    "head_movement": self.head_movements[template],
                    "blink_frequency": "normal",
                    "eye_behavior": self.eye_behaviors[template]
                },
                "animation_sequence": self._format_animation_sequence(pipeline_output.get("avatar_instructions", []))
            },
            "content": {
                "original_slide": pipeline_output.get("original_content", ""),
                "teacher_script": pipeline_output.get("teacher_script", ""),
                "script_chunks": self._chunk_for_speech(pipeline_output.get("teacher_script", "")),
                "comprehension_checkpoints": pipeline_output.get("comprehension_checkpoints", [])
            },
            "analysis": {
                "difficulty": pipeline_output.get("difficulty_analysis", {}),
                "context": pipeline_output.get("context", {}),
                "teaching_strategy": template
            }
        }
        
        output_file = self._save_to_file(package, template, is_multi=False)
        return package, output_file
    
    def _format_multi_template_package(self, pipeline_output):
        all_templates = ["patient_explainer", "insight_revealer", "gradual_builder", "clear_lecturer"]
        
        package = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "slide_count": pipeline_output.get("slide_index", 0) + 1,
                "total_duration": pipeline_output.get("total_duration", 0),
                "available_templates": all_templates,
                "selected_template": pipeline_output.get("selected_template", "patient_explainer"),
                "chunk_count": len(pipeline_output.get("avatar_instructions", []))
            },
            "templates": {},
            "original_content": pipeline_output.get("original_content", ""),
            "analysis": pipeline_output.get("analysis", {})
        }
        
        for template in all_templates:
            template_script = self._generate_template_script(pipeline_output, template)
            avatar_instructions = self._create_template_instructions(template_script, template, self.voice_profiles[template]["pace"])
            
            package["templates"][template] = {
                "voice_settings": self.voice_profiles[template],
                "lip_sync": self.lip_sync_profiles[template],
                "facial_animation": {
                    "base_expression": self.facial_expressions[template],
                    "head_movement": self.head_movements[template],
                    "eye_behavior": self.eye_behaviors[template],
                    "lip_sync_mode": self._get_lip_sync_mode(template)
                },
                "animation_sequence": self._format_animation_sequence(avatar_instructions),
                "content": {
                    "teacher_script": template_script,
                    "script_chunks": self._chunk_for_speech(template_script)
                }
            }
        
        output_file = self._save_to_file(package, "all_templates", is_multi=True)
        return package, output_file
    
    def _create_template_instructions(self, script, template, pace):
        sentences = [s.strip() for s in script.split('. ') if s.strip()]
        instructions = []
        current_time = 0
        
        for i, sentence in enumerate(sentences):
            word_count = len(sentence.split())
            base_duration = (word_count / 150) * 60 * 1000
            duration = base_duration / pace
            
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
                    "facial": self.facial_expressions[template],
                    "head": self.head_movements[template],
                    "eyes": self.eye_behaviors[template],
                    "lip_sync_mode": self._get_lip_sync_mode(template)
                }
            }
            instructions.append(chunk)
            current_time += duration
        
        return instructions
    
    def _format_animation_sequence(self, avatar_instructions):
        formatted_sequence = []
        
        for i, chunk in enumerate(avatar_instructions):
            formatted_chunk = {
                "id": f"chunk_{i}",
                "start_time": chunk.get("start_time", 0),
                "duration": chunk.get("duration", 0),
                "text": chunk.get("text", ""),
                "voice": chunk.get("voice", {}),
                "animation": {
                    "facial": chunk.get("avatar_animation", {}).get("facial", "neutral"),
                    "head": chunk.get("avatar_animation", {}).get("head", "neutral"),
                    "eyes": chunk.get("avatar_animation", {}).get("eyes", "forward"),
                    "lip_sync_mode": chunk.get("avatar_animation", {}).get("lip_sync_mode", "normal")
                }
            }
            formatted_sequence.append(formatted_chunk)
        
        return formatted_sequence
    
    def _chunk_for_speech(self, script, max_words=25):
        sentences = [s.strip() for s in script.split('. ') if s.strip()]
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence in sentences:
            words = sentence.split()
            word_count = len(words)
            
            if current_word_count + word_count <= max_words:
                current_chunk.append(sentence)
                current_word_count += word_count
            else:
                if current_chunk:
                    chunks.append('. '.join(current_chunk) + '.')
                current_chunk = [sentence]
                current_word_count = word_count
        
        if current_chunk:
            chunks.append('. '.join(current_chunk) + '.')
        
        return chunks
    
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
    
    def _generate_template_script(self, pipeline_output, template):
        base_script = pipeline_output.get("teacher_script", "")
        
        introductions = {
            "patient_explainer": "Let me explain this step by step. ",
            "insight_revealer": "Here's the key insight: ",
            "gradual_builder": "Building on what we learned: ",
            "clear_lecturer": "The important point is: "
        }
        
        return introductions.get(template, "") + base_script
    
    def _get_lip_sync_mode(self, template):
        lip_sync_modes = {
            "patient_explainer": "clear_slow",
            "insight_revealer": "emphatic_clear",
            "gradual_builder": "precise_clear",
            "clear_lecturer": "normal_clear"
        }
        return lip_sync_modes.get(template, "normal_clear")
    
    def _save_to_file(self, package, template_name, is_multi=False):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = "outputs"
        os.makedirs(output_dir, exist_ok=True)
        
        if is_multi:
            filename = f"{output_dir}/avatar_master_package_{timestamp}.json"
        else:
            filename = f"{output_dir}/avatar_package_{template_name}_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(package, f, indent=2)
        
        return filename