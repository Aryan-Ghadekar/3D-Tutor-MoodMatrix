import spacy
from textstat import flesch_reading_ease
import numpy as np

class SlideAnalyzer:
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], capture_output=True)
            self.nlp = spacy.load("en_core_web_sm")
        
    def analyze_slide(self, slide_content):
        """Deep NLP analysis of slide content"""
        doc = self.nlp(slide_content)
        
        analysis = {
            "sentence_count": len(list(doc.sents)),
            "word_count": len([token for token in doc if not token.is_punct]),
            "avg_sentence_length": self._avg_sentence_length(doc),            
            "readability_score": float(flesch_reading_ease(slide_content)),  
            "technical_term_count": self._count_technical_terms(doc),
            "formula_density": self._count_formulas(slide_content),            
            "main_topics": self._extract_main_topics(doc),
            "teaching_verbs": self._extract_teaching_verbs(doc),
            "question_presence": self._detect_questions(doc),
            "intent_signals": self._detect_intent_signals(doc)
        }
        
        return analysis
    
    def _avg_sentence_length(self, doc):
        """Calculate average sentence length"""
        sentences = list(doc.sents)
        if not sentences:
            return 0
        total_words = sum(len([token for token in sent if not token.is_punct]) for sent in sentences)
        return float(total_words / len(sentences)) 
    
    def _count_formulas(self, content):
        """Count mathematical formulas/symbols"""
        formula_symbols = {'=', '+', '-', '*', '/', '∂', '∫', '∑', '∏', '√'}
        return sum(1 for char in content if char in formula_symbols)
    
    def _extract_teaching_verbs(self, doc):
        """Extract teaching-related verbs"""
        teaching_verbs = {"explain", "describe", "define", "show", "demonstrate", 
                         "illustrate", "teach", "instruct", "clarify"}
        verbs = []
        for token in doc:
            if token.pos_ == "VERB" and token.lemma_.lower() in teaching_verbs:
                verbs.append(token.text)
        return list(set(verbs))[:3]
    
    def _detect_questions(self, doc):
        """Detect if slide contains questions"""
        return any(token.text == "?" for token in doc)
    
    def _detect_intent_signals(self, doc):
        """Detect teaching intent signals"""
        intent_words = {
            "simplify": ["simply", "simplify", "basic", "fundamental"],
            "clarify": ["clarify", "explain", "understand", "means"],
            "emphasize": ["important", "key", "crucial", "remember"],
            "example": ["example", "for instance", "such as", "consider"]
        }
        
        signals = {}
        text_lower = doc.text.lower()
        
        for intent, words in intent_words.items():
            signals[intent] = any(word in text_lower for word in words)
        
        return signals
    
    def _count_technical_terms(self, doc):
        """Count ML/AI technical terms"""
        ml_terms = {"gradient", "backpropagation", "neural", "activation", 
                   "loss", "optimizer", "epoch", "batch", "parameter", "derivative",
                   "algorithm", "function", "tensor", "layer", "weight", "bias"}
        return sum(1 for token in doc if token.text.lower() in ml_terms)
    
    def _extract_main_topics(self, doc):
        """Extract key topics using NLP"""
        topics = []
        for chunk in doc.noun_chunks:
            if len(chunk.text.split()) <= 3:  
                topics.append(chunk.text)
        return list(set(topics))[:5]