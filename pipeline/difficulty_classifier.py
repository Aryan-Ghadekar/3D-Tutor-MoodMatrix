from transformers import pipeline
import torch

class DifficultyClassifier:
    def __init__(self):
        self.classifier = pipeline(
            "zero-shot-classification",
            model="facebook/bart-large-mnli"
        )
        
    def classify_difficulty(self, slide_content, previous_content=None):
        """Classify cognitive difficulty level"""
        
        categories = [
            "remembering_facts",     
            "understanding_concepts", 
            "applying_knowledge",    
            "analyzing_complexity",  
            "evaluating_critically",
            "creating_new_ideas"     
        ]
        
        result = self.classifier(
            slide_content,
            candidate_labels=categories,
            multi_label=False
        )
        
        relative_difficulty = "same"
        if previous_content:
            prev_result = self.classifier(
                previous_content,
                candidate_labels=categories,
                multi_label=False
            )
            
            current_level = categories.index(result["labels"][0])
            prev_level = categories.index(prev_result["labels"][0])
            
            if current_level > prev_level + 1:
                relative_difficulty = "much_harder"
            elif current_level > prev_level:
                relative_difficulty = "harder"
            elif current_level < prev_level:
                relative_difficulty = "easier"
        
        return {
            "difficulty_level": result["labels"][0],
            "confidence": result["scores"][0],
            "relative_difficulty": relative_difficulty,
            "blooms_level": categories.index(result["labels"][0]) + 1
        }