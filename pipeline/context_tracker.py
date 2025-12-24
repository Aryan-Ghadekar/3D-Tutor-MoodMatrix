import numpy as np

class TeachingContextTracker:
    def __init__(self, window_size=3):
        self.slide_history = []
        self.context_window = window_size
        
    def update_context(self, current_slide, analysis):
        """Track teaching narrative in real-time"""
        
        self.slide_history.append({
            "content": current_slide,
            "analysis": analysis,
            "timestamp": len(self.slide_history)
        })
        
        if len(self.slide_history) > self.context_window:
            self.slide_history.pop(0)
        
        context = self._analyze_progression()
        
        return context
    
    def _analyze_progression(self):
        """Analyze how teaching is progressing - simplified without embeddings"""
        if len(self.slide_history) < 2:
            return {"phase": "introduction", "momentum": 0, "coherence": 1.0}
        
        similarities = []
        for i in range(len(self.slide_history)-1):
            words1 = self.slide_history[i]["analysis"]["word_count"]
            words2 = self.slide_history[i+1]["analysis"]["word_count"]            
            topics1 = set(self.slide_history[i]["analysis"]["main_topics"])
            topics2 = set(self.slide_history[i+1]["analysis"]["main_topics"])
            
            word_sim = 1.0 - min(abs(words1 - words2) / max(words1, words2, 1), 1.0)
            
            topic_overlap = 0
            if topics1 and topics2:
                topic_overlap = len(topics1.intersection(topics2)) / max(len(topics1), len(topics2))
            
            sim = 0.6 * word_sim + 0.4 * topic_overlap
            similarities.append(sim)
        
        avg_similarity = float(np.mean(similarities)) if similarities else 0.0
        
        if len(similarities) > 1 and similarities[-1] < 0.3:
            return {"phase": "topic_shift", "momentum": -0.5, "coherence": float(similarities[-1])}
        elif avg_similarity > 0.7:
            return {"phase": "deep_dive", "momentum": 0.8, "coherence": float(avg_similarity)}
        else:
            return {"phase": "steady_progress", "momentum": 0.3, "coherence": float(avg_similarity)}