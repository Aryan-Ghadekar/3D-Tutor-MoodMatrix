// src/lib/clip-verifier.js - COMPLETE NEW FILE

export class CLIPImageVerifier {
  constructor() {
    this.apiUrl = process.env.CLIP_API_URL || 
                 "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32";
    this.apiKey = process.env.HUGGINGFACE_TOKEN;
    this.cache = new Map();
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Verify image relevance to educational content
   */
  async verifyImageRelevance(imageUrl, educationalConcepts) {
    const cacheKey = `${imageUrl}_${educationalConcepts.join('_')}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            image_url: imageUrl,
            texts: this.prepareVerificationTexts(educationalConcepts)
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`CLIP API error: ${response.status}`);
      }
      
      const scores = await response.json();
      const result = this.analyzeScores(scores, educationalConcepts);
      
      // Cache result
      this.cache.set(cacheKey, result);
      
      return result;
      
    } catch (error) {
      console.error("CLIP verification failed:", error.message);
      return {
        isRelevant: false,
        confidence: 0,
        error: error.message,
        fallbackToHeuristics: true
      };
    }
  }

  /**
   * Prepare verification texts from educational concepts
   */
  prepareVerificationTexts(concepts) {
    const texts = [];
    
    concepts.forEach(concept => {
      // Direct concept
      texts.push(concept);
      
      // Educational variations
      texts.push(`educational diagram of ${concept}`);
      texts.push(`computer science ${concept}`);
      texts.push(`illustration showing ${concept}`);
      texts.push(`visual explanation ${concept}`);
      
      // Add synonyms for common CS terms
      const synonyms = this.getSynonyms(concept);
      synonyms.forEach(synonym => {
        texts.push(synonym);
        texts.push(`diagram of ${synonym}`);
      });
    });
    
    // Add generic educational terms
    texts.push(
      'educational diagram',
      'computer science illustration',
      'technical diagram',
      'concept visualization',
      'process flow diagram'
    );
    
    return [...new Set(texts)]; // Remove duplicates
  }

  /**
   * Analyze CLIP scores
   */
  analyzeScores(scores, concepts) {
    if (!Array.isArray(scores) || scores.length === 0) {
      return {
        isRelevant: false,
        confidence: 0,
        detailedScores: {}
      };
    }
    
    const detailedScores = {};
    let totalScore = 0;
    let maxScore = 0;
    
    concepts.forEach((concept, index) => {
      const conceptScores = scores[index] || [];
      const maxConceptScore = Math.max(...conceptScores);
      
      detailedScores[concept] = {
        score: maxConceptScore,
        interpretation: this.interpretScore(maxConceptScore)
      };
      
      totalScore += maxConceptScore;
      maxScore = Math.max(maxScore, maxConceptScore);
    });
    
    const averageScore = concepts.length > 0 ? totalScore / concepts.length : 0;
    const confidence = Math.max(averageScore, maxScore);
    
    return {
      isRelevant: confidence > 0.6, // Threshold
      confidence: confidence,
      detailedScores: detailedScores,
      primaryConcept: this.getPrimaryConcept(detailedScores),
      verificationMethod: 'CLIP'
    };
  }

  /**
   * Get synonyms for common CS terms
   */
  getSynonyms(concept) {
    const synonymMap = {
      'process': ['thread', 'task', 'program'],
      'synchronization': ['coordination', 'scheduling', 'locking'],
      'memory': ['RAM', 'storage', 'cache'],
      'algorithm': ['procedure', 'method', 'technique'],
      'database': ['data store', 'repository', 'bank']
    };
    
    const lowerConcept = concept.toLowerCase();
    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (lowerConcept.includes(key)) {
        return synonyms;
      }
    }
    
    return [];
  }

  /**
   * Interpret CLIP score
   */
  interpretScore(score) {
    if (score >= 0.8) return 'highly_relevant';
    if (score >= 0.6) return 'relevant';
    if (score >= 0.4) return 'somewhat_relevant';
    return 'not_relevant';
  }

  /**
   * Get primary concept from scores
   */
  getPrimaryConcept(detailedScores) {
    let maxScore = 0;
    let primaryConcept = '';
    
    Object.entries(detailedScores).forEach(([concept, data]) => {
      if (data.score > maxScore) {
        maxScore = data.score;
        primaryConcept = concept;
      }
    });
    
    return primaryConcept;
  }

  /**
   * Batch verify multiple images
   */
  async batchVerify(imagesWithConcepts) {
    const results = [];
    
    for (const item of imagesWithConcepts) {
      try {
        const result = await this.verifyImageRelevance(
          item.imageUrl,
          item.concepts
        );
        
        results.push({
          imageId: item.imageId,
          ...result
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`Batch verification failed for ${item.imageId}:`, error.message);
        results.push({
          imageId: item.imageId,
          isRelevant: false,
          confidence: 0,
          error: error.message
        });
      }
    }
    
    return results;
  }
}