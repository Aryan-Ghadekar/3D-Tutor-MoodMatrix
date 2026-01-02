import { NextResponse } from 'next/server';
import { getStudyPlan } from '@/lib/study-plan-storage';

const OPENROUTER_API_KEY = "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";

class StrictImageGenerator {
  constructor() {
    this.WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";
    this.maxImagesPerQuery = 8;
    this.minRelevanceScore = 0.7;
    this.cache = new Map();
    this.commonStopWords = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 
      'which', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'under', 'over', 'between', 'among'
    ]);
    this.academicStopPhrases = new Set([
      'introduction to', 'fundamentals of', 'principles of', 
      'concepts of', 'overview of', 'basics of', 'advanced'
    ]);
    
    this.imageTypes = [
      { type: 'diagram', terms: ['diagram', 'schematic', 'flowchart'] },
      { type: 'chart', terms: ['chart', 'graph', 'plot'] },
      { type: 'illustration', terms: ['illustration', 'drawing', 'sketch'] },
      { type: 'infographic', terms: ['infographic', 'visualization'] },
      { type: 'architecture', terms: ['architecture', 'structure', 'model'] },
      { type: 'process', terms: ['process', 'workflow', 'procedure'] },
      { type: 'comparison', terms: ['comparison', 'vs', 'versus'] },
      { type: 'concept', terms: ['concept', 'idea', 'theory'] }
    ];
  }

  async generateForTopic(topic, context = "", count = 2, actionType = 'default') {
    console.log(`Strict generation for: "${topic}" (${actionType})`);
    
    try {
      if (!this.shouldGenerateImages(topic, context, actionType)) {
        console.log("Skipping image generation");
        return [];
      }
      
      const searchQueries = this.generateStrictQueries(topic, context, actionType);
      console.log(`Generated ${searchQueries.length} strict queries`);
      
      const imageCandidates = await this.searchWithStrictFiltering(searchQueries, topic, actionType);
      
      if (imageCandidates.length === 0) {
        console.log("No strictly relevant images found");
        return [];
      }
      
      console.log(`Found ${imageCandidates.length} relevant candidate images`);
      
      const selectedImages = this.selectStrictlyRelevantImages(imageCandidates, topic, count, actionType);
      
      console.log(`Selected ${selectedImages.length} strictly relevant images`);
      
      return this.formatStrictEducationalImages(selectedImages, topic, context, actionType);
      
    } catch (error) {
      console.error("Strict image generation failed:", error.message);
      return [];
    }
  }

  shouldGenerateImages(topic, context, actionType) {
    const noImageActions = ['take-quiz', 'quiz-results'];
    if (noImageActions.includes(actionType)) {
      return false;
    }
    
    if (actionType === 'explain-more') {
      const visualKeywords = ['diagram', 'chart', 'graph', 'illustration', 'visual', 'process', 'flow'];
      const text = (topic + ' ' + context).toLowerCase();
      return visualKeywords.some(keyword => text.includes(keyword));
    }
    
    if (actionType === 'ask-question') {
      const visualQuestionKeywords = ['diagram', 'chart', 'graph', 'image', 'picture', 'visualize'];
      const text = context.toLowerCase();
      return visualQuestionKeywords.some(keyword => text.includes(keyword));
    }
    
    const inherentlyVisualTopics = [
      'architecture', 'diagram', 'chart', 'graph', 'flowchart', 
      'process', 'system', 'network', 'structure', 'model'
    ];
    
    const topicLower = topic.toLowerCase();
    return inherentlyVisualTopics.some(visualTopic => topicLower.includes(visualTopic));
  }

  generateStrictQueries(topic, context = "", actionType = 'default') {
    const queries = new Set();
    
    const simplifiedTopic = this.simplifyAcademicTitle(topic);
    console.log(`Simplified topic: "${simplifiedTopic}" for ${actionType}`);
    
    switch(actionType) {
      case 'explain-more':
        this.generateStrictExplanationQueries(simplifiedTopic, context, queries);
        break;
      case 'ask-question':
        this.generateStrictQuestionQueries(simplifiedTopic, context, queries);
        break;
      default:
        this.generateStrictGeneralQueries(simplifiedTopic, context, queries);
        break;
    }
    
    this.addStrictContextualVariations(simplifiedTopic, context, queries);
    
    const strictQueries = this.ensureQueryStrictness(Array.from(queries));
    
    console.log(`Strict queries:`, strictQueries.slice(0, 5));
    
    return strictQueries.slice(0, 15);
  }

  generateStrictExplanationQueries(topic, context, queries) {
    console.log("Generating strict explanation-focused queries");
    
    const explanationTypes = ['diagram', 'process diagram', 'flowchart'];
    
    explanationTypes.forEach(type => {
      queries.add(`${topic} ${type}`);
      queries.add(`${type} of ${topic}`);
      
      if (context) {
        const specificTerms = this.extractSpecificVisualTerms(context);
        specificTerms.forEach(term => {
          if (term.length > 3) {
            queries.add(`${term} ${type}`);
            queries.add(`${type} ${term}`);
          }
        });
      }
    });
    
    if (context && (context.includes('work') || context.includes('mechanism') || context.includes('function'))) {
      queries.add(`how ${topic} works diagram`);
      queries.add(`${topic} mechanism diagram`);
    }
  }

  generateStrictQuestionQueries(topic, context, queries) {
    console.log("Generating strict question-focused queries");
    
    if (!context) return;
    
    const visualElements = this.extractVisualElementsFromQuestion(context);
    visualElements.forEach(element => {
      if (element.length > 3) {
        queries.add(element);
        queries.add(`${element} diagram`);
        queries.add(`${topic} ${element}`);
      }
    });
    
    if (context.includes('compare') || context.includes('difference') || context.includes('vs')) {
      queries.add(`${topic} comparison diagram`);
    }
  }

  generateStrictGeneralQueries(topic, context, queries) {
    console.log("Generating strict general queries");
    
    if (!this.isInherentlyVisualTopic(topic)) {
      return;
    }
    
    this.imageTypes.forEach(({ type, terms }) => {
      const relevantTerms = terms.filter(term => {
        const topicLower = topic.toLowerCase();
        const contextLower = (context || '').toLowerCase();
        return topicLower.includes(term) || contextLower.includes(term);
      });
      
      relevantTerms.forEach(term => {
        queries.add(`${topic} ${term}`);
        queries.add(`${term} of ${topic}`);
      });
    });
  }

  addStrictContextualVariations(topic, context, queries) {
    if (!context || context.length < 20) return;
    
    console.log("Adding strict contextual variations");
    
    const visualKeywords = ['diagram', 'chart', 'graph', 'illustration', 'figure', 'image'];
    const sentences = context.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      if (visualKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        const words = sentence.split(/\s+/)
          .filter(word => word.length > 3 && /^[A-Z]/.test(word))
          .slice(0, 2);
        
        if (words.length > 0) {
          words.forEach(word => {
            queries.add(`${word} diagram`);
            queries.add(`${topic} ${word}`);
          });
        }
      }
    });
  }

  ensureQueryStrictness(queries) {
    const strictQueries = queries.filter(query => {
      const lowerQuery = query.toLowerCase();
      
      const genericTerms = ['overview', 'basics', 'introduction', 'fundamentals', 'general'];
      if (genericTerms.some(term => lowerQuery.includes(term))) {
        return false;
      }
      
      const visualTerms = ['diagram', 'chart', 'graph', 'illustration', 'image', 'figure'];
      if (!visualTerms.some(term => lowerQuery.includes(term))) {
        return false;
      }
      
      return true;
    });
    
    return [...new Set(strictQueries)];
  }

  isInherentlyVisualTopic(topic) {
    const visualKeywords = [
      'architecture', 'diagram', 'chart', 'graph', 'flowchart', 'process',
      'system', 'network', 'structure', 'model', 'map', 'timeline',
      'hierarchy', 'taxonomy', 'classification', 'comparison'
    ];
    
    const topicLower = topic.toLowerCase();
    return visualKeywords.some(keyword => topicLower.includes(keyword));
  }

  extractSpecificVisualTerms(context) {
    const terms = new Set();
    const visualIndicators = ['shown in', 'illustrated by', 'depicted in', 'as seen in', 'figure', 'diagram'];
    
    visualIndicators.forEach(indicator => {
      const index = context.toLowerCase().indexOf(indicator);
      if (index !== -1) {
        const afterIndicator = context.substring(index + indicator.length, index + indicator.length + 30);
        const words = afterIndicator.split(/\s+/)
          .filter(word => word.length > 3 && /^[A-Z]/.test(word))
          .slice(0, 3);
        
        words.forEach(word => terms.add(word));
      }
    });
    
    return Array.from(terms);
  }

  extractVisualElementsFromQuestion(context) {
    const elements = new Set();
    
    const quotedElements = context.match(/["']([^"']+)["']/g);
    if (quotedElements) {
      quotedElements.forEach(element => {
        const cleanElement = element.replace(/["']/g, '').toLowerCase();
        if (cleanElement.length > 3) {
          elements.add(cleanElement);
        }
      });
    }
    
    if (context.includes('figure') || context.includes('diagram')) {
      const figurePattern = /(figure|diagram)\s+(\d+|[A-Z])/gi;
      const matches = context.match(figurePattern);
      if (matches) {
        matches.forEach(match => elements.add(match.toLowerCase()));
      }
    }
    
    return Array.from(elements);
  }

  async searchWithStrictFiltering(queries, topic, actionType) {
    const allImages = [];
    const seenImageUrls = new Set();
    
    for (const query of queries.slice(0, 8)) {
      try {
        console.log(`Strict search: "${query}"`);
        
        const images = await this.searchSingleQuery(query);
        
        const relevantImages = images.filter(image => {
          const relevance = this.calculateStrictRelevance(image, topic, query, actionType);
          image.strictRelevance = relevance;
          return relevance >= this.minRelevanceScore;
        });
        
        relevantImages.forEach(image => {
          if (!seenImageUrls.has(image.url)) {
            seenImageUrls.add(image.url);
            image.imageType = this.categorizeImageType(image, query);
            image.searchQuery = query;
            allImages.push(image);
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (relevantImages.length >= 2) {
          console.log(`Found ${relevantImages.length} strictly relevant images`);
          break;
        }
        
      } catch (error) {
        console.warn(`Strict search failed for "${query}":`, error.message);
        continue;
      }
    }
    
    return allImages;
  }

  calculateStrictRelevance(image, topic, query, actionType) {
    let score = 0;
    
    const imageText = (image.title + ' ' + image.description).toLowerCase();
    const topicLower = topic.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (imageText.includes(topicLower)) {
      score += 0.4;
    }
    
    const topicWords = topicLower.split(/\s+/).filter(w => w.length > 3);
    topicWords.forEach(word => {
      if (imageText.includes(word)) score += 0.15;
    });
    
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);
    queryWords.forEach(word => {
      if (imageText.includes(word)) score += 0.1;
    });
    
    if (actionType === 'explain-more') {
      if (imageText.includes('diagram') || imageText.includes('process')) score += 0.2;
    } else if (actionType === 'ask-question') {
      if (imageText.includes('example') || imageText.includes('specific')) score += 0.2;
    }
    
    const educationalTerms = ['educational', 'learning', 'teaching', 'academic'];
    if (educationalTerms.some(term => imageText.includes(term))) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  selectStrictlyRelevantImages(images, topic, count, actionType) {
    if (images.length === 0) return [];
    
    const sortedImages = images.sort((a, b) => {
      const scoreA = (a.strictRelevance || 0) * 0.7 + (a.qualityScore || 0) * 0.3;
      const scoreB = (b.strictRelevance || 0) * 0.7 + (b.qualityScore || 0) * 0.3;
      return scoreB - scoreA;
    });
    
    const selectedImages = sortedImages.slice(0, count);
    
    return selectedImages.filter(img => (img.strictRelevance || 0) >= this.minRelevanceScore);
  }

  formatStrictEducationalImages(images, topic, context, actionType) {
    return images.map((image, index) => ({
      type: 'strict_educational_image',
      id: `img_${Date.now()}_${index}`,
      source: 'wikimedia_commons',
      url: image.url,
      thumbnail: image.url,
      originalUrl: image.originalUrl,
      title: this.generateDisplayTitle(image, topic, index),
      description: this.generateDisplayDescription(image, topic, context),
      caption: this.generateStrictCaption(image, topic, context, index, actionType),
      altText: this.generateStrictAltText(image, topic),
      _metadata: {
        author: image.author,
        license: image.license,
        relevanceScore: image.relevanceScore,
        strictRelevance: image.strictRelevance,
        qualityScore: image.qualityScore,
        imageType: image.imageType || 'general',
        dimensions: `${image.width}x${image.height}`,
        fileType: image.mime,
        searchQuery: image.searchQuery,
        sourceUrl: image.originalUrl
      }
    }));
  }

  generateDisplayTitle(image, topic, index) {
    const imageType = image.imageType || 'illustration';
    return `${imageType.charAt(0).toUpperCase() + imageType.slice(1)}: ${topic}`;
  }

  generateDisplayDescription(image, topic, context) {
    const imageType = this.determineImageType(image);
    return `${imageType} explaining ${topic}. ${context ? 'Related to current discussion.' : ''}`;
  }

  generateStrictCaption(image, topic, context, index, actionType) {
    let caption = `Figure ${index + 1}: `;
    
    if (image.description && image.description.length > 20 && image.description.length < 100) {
      caption += `${image.description}. `;
    }
    
    caption += `This ${image.imageType || 'visual'} directly relates to ${topic}.`;
    
    if (actionType === 'explain-more') {
      caption += ` Use it to visualize the explanation.`;
    } else if (actionType === 'ask-question') {
      caption += ` Refer to it while considering the question.`;
    }
    
    return caption;
  }

  generateStrictAltText(image, topic) {
    const imageType = this.determineImageType(image);
    return `${imageType} about ${topic}. ${image.description ? image.description.substring(0, 100) : 'Educational visual aid.'}`;
  }

  determineImageType(image) {
    const text = (image.title + ' ' + image.description).toLowerCase();
    
    if (text.includes('diagram') || text.includes('schematic')) return 'Diagram';
    if (text.includes('chart') || text.includes('graph')) return 'Chart';
    if (text.includes('flowchart')) return 'Flowchart';
    if (text.includes('illustration') || text.includes('drawing')) return 'Illustration';
    if (text.includes('infographic')) return 'Infographic';
    if (text.includes('architecture')) return 'Architecture diagram';
    
    return 'Educational image';
  }

  simplifyAcademicTitle(title) {
    let simplified = title.toLowerCase().trim();
    
    this.academicStopPhrases.forEach(phrase => {
      if (simplified.startsWith(phrase)) {
        simplified = simplified.substring(phrase.length).trim();
      }
    });
    
    simplified = simplified.replace(/\([^)]*\)/g, '').trim();
    
    const dashIndex = simplified.indexOf(' - ');
    const colonIndex = simplified.indexOf(': ');
    const separatorIndex = Math.max(dashIndex, colonIndex);
    
    if (separatorIndex > 0 && simplified.length > 30) {
      simplified = simplified.substring(0, separatorIndex).trim();
    }
    
    const words = simplified.split(/\s+/);
    const filteredWords = words.filter(word => 
      !this.commonStopWords.has(word) && word.length > 2
    );
    
    const meaningfulWords = filteredWords.slice(0, 5);
    
    return meaningfulWords.join(' ') || title.toLowerCase();
  }

  categorizeImageType(image, query) {
    const text = (image.title + ' ' + image.description).toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    for (const { type, terms } of this.imageTypes) {
      if (terms.some(term => lowerQuery.includes(term))) {
        return type;
      }
    }
    
    for (const { type, terms } of this.imageTypes) {
      if (terms.some(term => text.includes(term))) {
        return type;
      }
    }
    
    return 'general';
  }

  async searchSingleQuery(query) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: `"${query}" filetype:bitmap|drawing|svg|pdf`,
      gsrnamespace: '6',
      gsrlimit: this.maxImagesPerQuery.toString(),
      prop: 'imageinfo|pageimages',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '800',
      piprop: 'thumbnail',
      pithumbsize: '400',
      origin: '*'
    });
    
    const response = await fetch(`${this.WIKIMEDIA_API_URL}?${params}`, {
      headers: {
        'User-Agent': 'EducationalApp/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return this.parseWikimediaResponse(data, query);
  }

  parseWikimediaResponse(data, query) {
    const images = [];
    
    if (!data.query || !data.query.pages) {
      return images;
    }
    
    Object.values(data.query.pages).forEach(page => {
      if (!page.imageinfo || !page.imageinfo[0]) return;
      
      const imageInfo = page.imageinfo[0];
      
      if (imageInfo.width < 200 || imageInfo.height < 200) return;
      if (!imageInfo.mime?.startsWith('image/')) return;
      
      const metadata = imageInfo.extmetadata || {};
      
      const image = {
        id: page.pageid,
        title: page.title?.replace('File:', '').replace(/\.[^/.]+$/, '') || 'Untitled',
        description: metadata.ImageDescription?.value || 
                    metadata.ObjectName?.value || 
                    metadata.Caption?.value || '',
        author: metadata.Artist?.value || 'Unknown',
        license: metadata.LicenseShortName?.value || 'Unknown',
        url: imageInfo.thumburl || imageInfo.url,
        originalUrl: imageInfo.url,
        width: imageInfo.width,
        height: imageInfo.height,
        mime: imageInfo.mime,
        size: imageInfo.size,
        categories: metadata.Categories?.value?.split('|') || [],
        searchQuery: query,
        source: 'wikimedia',
        timestamp: new Date().toISOString()
      };
      
      image.relevanceScore = this.calculateRelevanceScore(image, query);
      image.qualityScore = this.calculateQualityScore(image);
      
      images.push(image);
    });
    
    return images;
  }

  calculateRelevanceScore(image, query) {
    let score = 0.3;
    
    const searchText = (image.title + ' ' + image.description).toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    if (searchText.includes(queryLower)) {
      score += 0.3;
    }
    
    queryWords.forEach(word => {
      if (searchText.includes(word)) {
        score += 0.1;
      }
    });
    
    if (image.categories.length > 0) {
      const categoryMatch = image.categories.some(cat => 
        queryWords.some(word => cat.toLowerCase().includes(word))
      );
      if (categoryMatch) score += 0.1;
    }
    
    const eduTerms = ['diagram', 'chart', 'graph', 'illustration', 'educational', 'infographic'];
    const hasEduTerm = eduTerms.some(term => searchText.includes(term));
    if (hasEduTerm) score += 0.15;
    
    return Math.min(score, 1.0);
  }

  calculateQualityScore(image) {
    let score = 0.5;
    
    if (image.width >= 800 && image.height >= 600) score += 0.2;
    if (image.width >= 1200 && image.height >= 800) score += 0.1;
    
    if (image.description && image.description.length > 20) score += 0.1;
    if (image.author && image.author !== 'Unknown') score += 0.05;
    if (image.license) score += 0.05;
    
    if (image.mime === 'image/svg+xml') score += 0.2;
    
    return Math.min(score, 1.0);
  }
}

class EnhancedQuizEngine {
  constructor() {
    this.questionTypes = [
      'conceptual_understanding',
      'application_scenario',
      'analysis_comparison',
      'synthesis_evaluation',
      'problem_solving'
    ];
  }

  async generateStrictQuiz(topic, context, count = 5, difficulty = 'medium', studentGoal = 'gate') {
    console.log(`Generating strict quiz for: "${topic}" (Goal: ${studentGoal})`);
    
    try {
      const prompt = this.buildStrictQuizPrompt(topic, context, count, difficulty, studentGoal);
      const quizData = await this.callQuizAI(prompt);
      
      const validatedQuiz = this.validateAndEnhanceQuiz(quizData, topic, context, studentGoal);
      
      validatedQuiz.adaptiveLogic = this.buildAdaptiveLogic(validatedQuiz.questions);
      
      return validatedQuiz;
      
    } catch (error) {
      console.error("Quiz generation failed:", error.message);
      return this.createStrictFallbackQuiz(topic, count, difficulty, studentGoal);
    }
  }

  buildStrictQuizPrompt(topic, context, count, difficulty, studentGoal) {
    return `Create ${count} STRICTLY RELEVANT multiple-choice questions about "${topic}".

CONTEXT: ${context || 'General understanding of the topic'}

STUDENT GOAL: ${studentGoal.toUpperCase()}
- GATE: Focus on problem-solving, time management, exam patterns
- JEE: Emphasize conceptual depth and multiple approaches  
- NEET: Use biological systems connections and memorization
- Concept Mastery: Build from first principles

STRICT REQUIREMENTS:
1. Each question MUST be directly related to current slide content
2. Questions should test different cognitive levels
3. All options must be plausible but only one is strictly correct
4. Provide DETAILED explanations for both correct and incorrect answers
5. Include common pitfalls and exam relevance
6. Questions should progressively build on each other

DIFFICULTY: ${difficulty.toUpperCase()}
- Easy: Focus on basic concepts and definitions
- Medium: Mix of concepts and simple applications  
- Hard: Complex applications and analysis
- Challenge: Synthesis, evaluation, and edge cases

EXAM-SPECIFIC FOCUS:
${this.getExamSpecificGuidance(studentGoal)}

RESPONSE FORMAT - Return STRICT JSON:
{
  "quizTitle": "Strict Quiz: ${topic}",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "goal": "${studentGoal}",
  "questions": [
    {
      "id": "q1",
      "text": "Clear, unambiguous question text?",
      "options": [
        {"id": "A", "text": "Option A text"},
        {"id": "B", "text": "Option B text"},
        {"id": "C", "text": "Option C text"},
        {"id": "D", "text": "Option D text"}
      ],
      "correctAnswer": "A",
      "detailedExplanation": "Why this answer is correct, with reference to current content",
      "wrongAnswerExplanations": {
        "B": "Why option B is wrong - common mistake",
        "C": "Why option C is wrong - misconception",
        "D": "Why option D is wrong - subtle error"
      },
      "commonPitfalls": ["Specific pitfalls students encounter"],
      "examRelevance": "How this appears in ${studentGoal.toUpperCase()} exams",
      "conceptsTested": ["Concept 1", "Concept 2"],
      "cognitiveLevel": "conceptual_understanding",
      "prerequisiteKnowledge": ["What students need to know first"],
      "nextStepIfCorrect": {
        "action": "offer_harder_question",
        "concept": "next_concept_to_test"
      },
      "nextStepIfWrong": {
        "action": "generate_explanation_slide",
        "focusAreas": ["specific_misunderstanding"],
        "explanationFocus": "Detailed focus on the mistake"
      }
    }
  ],
  "overallAdaptation": {
    "scoringRubric": {
      "90-100": "Offer challenge questions",
      "70-89": "Continue with similar difficulty",
      "50-69": "Review foundational concepts",
      "below-50": "Generate explanation slides for all mistakes"
    },
    "mistakePatternDetection": {
      "conceptBased": true,
      "cognitiveLevelBased": true,
      "patternThreshold": 2
    }
  }
}`;
  }

  getExamSpecificGuidance(goal) {
    switch(goal.toLowerCase()) {
      case 'gate':
        return "- Include numerical problems and time-based calculations\n- Focus on engineering applications\n- Emphasize multi-step problem solving";
      case 'jee':
        return "- Include multiple solution approaches\n- Focus on conceptual understanding\n- Emphasize formula applications";
      case 'neet':
        return "- Include biological processes and systems\n- Focus on memorization techniques\n- Emphasize diagram-based questions";
      default:
        return "- Focus on foundational understanding\n- Build from basic to complex\n- Emphasize real-world applications";
    }
  }

  async callQuizAI(prompt) {
    if (!OPENROUTER_API_KEY) {
      throw new Error("API key not configured.");
    }
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content: `You are a strict quiz generation expert. Create ONLY relevant, well-structured quiz questions with detailed explanations. Return STRICT JSON format.`
            },
            {
              role: "user",
              content: prompt.substring(0, 3000)
            }
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content in AI response");
      }
      
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '').trim() : content;
      return JSON.parse(jsonStr);
      
    } catch (error) {
      console.error("Quiz AI call failed:", error.message);
      throw error;
    }
  }

  validateAndEnhanceQuiz(quizData, topic, context, studentGoal) {
    const validated = {
      quizTitle: quizData.quizTitle || `Strict Quiz: ${topic}`,
      topic: quizData.topic || topic,
      difficulty: quizData.difficulty || 'medium',
      goal: studentGoal,
      questions: []
    };
    
    quizData.questions?.forEach((q, index) => {
      const validatedQuestion = {
        id: q.id || `q${index + 1}`,
        text: q.text || `Question ${index + 1} about ${topic}`,
        options: this.validateOptions(q.options),
        correctAnswer: q.correctAnswer || 'A',
        detailedExplanation: q.detailedExplanation || `Explanation for question ${index + 1}`,
        wrongAnswerExplanations: q.wrongAnswerExplanations || this.generateDefaultWrongExplanations(),
        commonPitfalls: q.commonPitfalls || [`Common misunderstanding about ${topic}`],
        examRelevance: q.examRelevance || `Relevant for ${studentGoal.toUpperCase()} exams`,
        conceptsTested: q.conceptsTested || [topic.split(' ')[0]],
        cognitiveLevel: q.cognitiveLevel || this.questionTypes[index % this.questionTypes.length],
        prerequisiteKnowledge: q.prerequisiteKnowledge || [`Understanding of basic ${topic} concepts`],
        nextStepIfCorrect: q.nextStepIfCorrect || {
          action: "offer_harder_question",
          concept: "advanced_aspect"
        },
        nextStepIfWrong: q.nextStepIfWrong || {
          action: "generate_explanation_slide",
          focusAreas: ["specific_concept"],
          explanationFocus: "Detailed focus on the misunderstanding"
        }
      };
      
      validated.questions.push(validatedQuestion);
    });
    
    if (validated.questions.length < 5) {
      validated.questions = validated.questions.concat(
        this.createAdditionalQuestions(topic, 5 - validated.questions.length, studentGoal)
      );
    }
    
    return validated;
  }

  validateOptions(options) {
    if (!options || !Array.isArray(options)) {
      return [
        { id: "A", text: "Option A" },
        { id: "B", text: "Option B" },
        { id: "C", text: "Option C" },
        { id: "D", text: "Option D" }
      ];
    }
    
    const validated = options.slice(0, 4);
    while (validated.length < 4) {
      validated.push({ 
        id: String.fromCharCode(65 + validated.length), 
        text: `Option ${String.fromCharCode(65 + validated.length)}` 
      });
    }
    
    return validated;
  }

  generateDefaultWrongExplanations() {
    return {
      "B": "This option represents a common misunderstanding.",
      "C": "This option confuses related but different concepts.",
      "D": "This option applies the right principle to the wrong context."
    };
  }

  createAdditionalQuestions(topic, count, studentGoal) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `aq${i + 1}`,
        text: `Additional question ${i + 1} about ${topic}`,
        options: [
          { id: "A", text: "Correct understanding" },
          { id: "B", text: "Common misconception" },
          { id: "C", text: "Related but incorrect concept" },
          { id: "D", text: "Misapplied principle" }
        ],
        correctAnswer: "A",
        detailedExplanation: `Detailed explanation for additional question ${i + 1}`,
        wrongAnswerExplanations: this.generateDefaultWrongExplanations(),
        commonPitfalls: [`Pitfall ${i + 1} for ${topic}`],
        examRelevance: `Tests ${studentGoal.toUpperCase()} relevant understanding`,
        conceptsTested: [topic],
        cognitiveLevel: this.questionTypes[i % this.questionTypes.length],
        prerequisiteKnowledge: [`Basic ${topic} concepts`]
      });
    }
    return questions;
  }

  buildAdaptiveLogic(questions) {
    return {
      questionProgression: this.buildQuestionProgression(questions),
      mistakeHandling: this.buildMistakeHandling(),
      scoringStrategy: this.buildScoringStrategy(),
      explanationGeneration: this.buildExplanationGeneration()
    };
  }

  buildQuestionProgression(questions) {
    const progression = [];
    let currentDifficulty = 'medium';
    
    questions.forEach((q, index) => {
      progression.push({
        questionId: q.id,
        sequence: index + 1,
        baseDifficulty: currentDifficulty,
        nextIfCorrect: index < questions.length - 1 ? questions[index + 1].id : 'quiz_complete',
        nextIfWrong: `explanation_${q.id}`,
        adaptiveAdjustment: {
          correctCountForHarder: 2,
          wrongCountForEasier: 1
        }
      });
      
      if (index > 0 && index % 2 === 0) {
        currentDifficulty = this.increaseDifficulty(currentDifficulty);
      }
    });
    
    return progression;
  }

  increaseDifficulty(current) {
    const levels = ['easy', 'medium', 'hard', 'challenge'];
    const index = levels.indexOf(current);
    return index < levels.length - 1 ? levels[index + 1] : current;
  }

  buildMistakeHandling() {
    return {
      immediateFeedback: true,
      explanationSlides: {
        generateFor: ['first_mistake', 'repeated_mistake', 'conceptual_error'],
        contentFocus: ['why_wrong', 'correct_concept', 'common_pitfalls', 'exam_tips'],
        includeExamples: true,
        includePractice: true
      },
      patternDetection: {
        byConcept: true,
        byCognitiveLevel: true,
        thresholdForReview: 2
      }
    };
  }

  buildScoringStrategy() {
    return {
      pointsPerQuestion: 10,
      difficultyMultiplier: {
        easy: 0.8,
        medium: 1.0,
        hard: 1.2,
        challenge: 1.5
      },
      partialCredit: false,
      timeBonus: false,
      streakBonus: true
    };
  }

  buildExplanationGeneration() {
    return {
      triggers: ['wrong_answer', 'request_for_help', 'timeout'],
      contentStructure: [
        "Restate the question and correct answer",
        "Explain why the correct answer is right",
        "Analyze why wrong answers are incorrect",
        "Highlight common pitfalls",
        "Provide exam-specific tips",
        "Offer practice scenarios"
      ],
      adaptiveDepth: {
        firstMistake: 'basic',
        repeatedMistake: 'detailed',
        conceptualError: 'comprehensive'
      }
    };
  }

  createStrictFallbackQuiz(topic, count, difficulty, studentGoal) {
    const questions = [];
    
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `fq${i + 1}`,
        text: `Fallback question ${i + 1}: Which statement about ${topic} is correct?`,
        options: [
          { id: "A", text: "The fundamental principle applies universally" },
          { id: "B", text: "It only works in specific cases" },
          { id: "C", text: "It contradicts established theory" },
          { id: "D", text: "It has no practical applications" }
        ],
        correctAnswer: "A",
        detailedExplanation: `The fundamental principle of ${topic} applies universally because it addresses core concepts that transcend specific implementations.`,
        wrongAnswerExplanations: {
          "B": "While there are specific cases, the principle has broader application",
          "C": "The principle aligns with and extends established theory",
          "D": "There are numerous practical applications in real-world systems"
        },
        commonPitfalls: ["Over-specifying the context", "Missing the universal aspect"],
        examRelevance: `Relevant for ${studentGoal.toUpperCase()} exams testing fundamental understanding`,
        conceptsTested: [topic],
        cognitiveLevel: this.questionTypes[i % this.questionTypes.length],
        prerequisiteKnowledge: [`Basic ${topic} concepts`]
      });
    }
    
    return {
      quizTitle: `Strict Quiz: ${topic}`,
      topic: topic,
      difficulty: difficulty,
      goal: studentGoal,
      questions: questions,
      adaptiveLogic: this.buildAdaptiveLogic(questions)
    };
  }
}

class DynamicContentEngine {
  constructor() {
    this.contentStyles = {
      'explain-more': this.getExplainMoreStyle(),
      'ask-question': this.getDoubtResolutionStyle(),
      'take-quiz': this.getQuizStyle(),
      'quiz-results': this.getQuizResultsStyle(),
      'default': this.getDefaultStyle()
    };
  }

  getExplainMoreStyle() {
    return {
      name: "Enhanced Explanations",
      template: `Create an ENHANCED EXPLANATION that deepens understanding:

FOCUS ON:
• Clear, intuitive analogies from real-world scenarios
• Visualizable concepts and mental models
• Practical applications and immediate use cases
• Common misconceptions and how to avoid them

VARY YOUR APPROACH:
Choose 1-2 of these formats to mix:
1. **Story-based explanation** - Walk through a narrative
2. **Analogy exploration** - Compare to familiar systems
3. **Step-by-step breakdown** - Build understanding gradually
4. **Visual diagram description** - Create mental imagery
5. **Real-world case study** - Show practical application`
    };
  }

  getDoubtResolutionStyle() {
    return {
      name: "Precise Doubt Resolution",
      template: `RESOLVE THIS SPECIFIC DOUBT: "{DOUBT}"

REQUIREMENTS:
• **Direct Answer First** - Clear, concise response addressing the exact doubt
• **Multiple Perspectives** - Show 2-3 different ways to understand it
• **Root Cause Analysis** - Identify why the confusion occurs
• **Practical Examples** - Concrete scenarios illustrating the concept
• **Verification Check** - How the student can confirm understanding`
    };
  }

  getQuizStyle() {
    return {
      name: "Adaptive Quiz Engine",
      template: `CREATE ADAPTIVE QUIZ with intelligent progression:

QUIZ DESIGN:
• 5-6 questions of varying cognitive levels
• Mix of conceptual understanding and application
• Clear distinction between plausible options
• Progressive difficulty based on performance

ADAPTIVE LOGIC:
• Track specific mistake patterns
• Adjust next question difficulty dynamically
• Provide immediate, constructive feedback
• Offer follow-up questions for weak areas`
    };
  }

  getQuizResultsStyle() {
    return {
      name: "Intelligent Quiz Analysis",
      template: `ANALYZE QUIZ RESULTS and provide personalized feedback:

ANALYSIS FOCUS:
• Identify specific knowledge gaps
• Explain why wrong answers were incorrect
• Connect mistakes to underlying concepts
• Suggest targeted improvement strategies`
    };
  }

  getDefaultStyle() {
    return {
      name: "Dynamic Learning Content",
      template: `Create VARIED, ENGAGING learning content:

VARIATION IS KEY:
Mix different formats across slides to maintain engagement.
Avoid repetition of the same structure.`
    };
  }

  getActionTemplate(actionType, context = "", studentGoal = "gate") {
    const style = this.contentStyles[actionType] || this.contentStyles.default;
    const goalSpecific = this.getGoalSpecificGuidance(studentGoal);
    
    switch (actionType) {
      case 'explain-more':
        return {
          ...style,
          promptTemplate: `You are an expert tutor specializing in DEEPENING UNDERSTANDING.

${style.template.replace('{DOUBT}', context)}

${goalSpecific}

Focus on making complex ideas intuitive through creative approaches.`
        };

      case 'ask-question':
        return {
          ...style,
          promptTemplate: `You are a precision tutor focused on SPECIFIC DOUBT RESOLUTION.

${style.template.replace('{DOUBT}', context)}

${goalSpecific}

Address the exact doubt directly, then build supporting understanding.`
        };

      case 'take-quiz':
        return {
          ...style,
          promptTemplate: `You are an adaptive assessment expert creating INTELLIGENT QUIZZES.

${style.template}

Topic: ${context}

${goalSpecific}

Design questions that test different cognitive levels.`
        };

      case 'quiz-results':
        return {
          ...style,
          promptTemplate: `You are a learning analyst providing PERSONALIZED QUIZ FEEDBACK.

${style.template}

${goalSpecific}

Analyze performance patterns and create targeted improvement guidance.`
        };

      default:
        return {
          ...style,
          promptTemplate: `You are an engaging educator creating VARIED LEARNING CONTENT.

${style.template}

Topic: ${context}

${goalSpecific}

Create content that feels fresh and engaging.`
        };
    }
  }

  getGoalSpecificGuidance(goal) {
    switch(goal.toLowerCase()) {
      case 'gate':
        return `GATE EXAM FOCUS:
• Emphasize problem-solving approaches
• Include time management tips
• Connect to engineering applications
• Provide exam-specific strategies`;
      case 'jee':
        return `JEE ADVANCED FOCUS:
• Emphasize conceptual depth
• Include multiple solution methods
• Focus on formula applications
• Provide competitive exam insights`;
      case 'neet':
        return `NEET UG FOCUS:
• Use biological system connections
• Include memorization techniques
• Focus on diagram-based learning
• Provide medical exam relevance`;
      default:
        return `CONCEPT MASTERY FOCUS:
• Build from first principles
• Emphasize fundamental understanding
• Connect to real-world applications
• Provide varied learning approaches`;
    }
  }
}

export async function POST(req) {
  try {
    const requestData = await req.json();
    
    console.log("GENERATE-SLIDE REQUEST:", {
      action: requestData.requestedAction,
      sessionId: requestData.sessionId,
      goal: requestData.studentGoal
    });
    
    const { sessionId, studentGoal = "gate", requestedAction = null } = requestData;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId is required",
        fallback: true
      }, { status: 400 });
    }
    
    const studyPlan = getStudyPlan(sessionId);
    if (!studyPlan) {
      console.warn(`No study plan found for session: ${sessionId}`);
      
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`studyPlan_${sessionId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`Found study plan in localStorage for session: ${sessionId}`);
          return await processActionRequest(requestData, parsed, studentGoal);
        }
      }
      
      return NextResponse.json({
        success: false,
        error: `No study plan found for session: ${sessionId}`,
        fallback: true,
        slide: createStudyPlanFallback(requestData)
      }, { status: 404 });
    }
    
    console.log(`Found study plan: ${studyPlan.topic || 'Unknown topic'}`);
    
    const validatedGoal = validateStudentGoal(studentGoal);
    
    const response = await processActionRequest(requestData, studyPlan, validatedGoal);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("GENERATE-SLIDE ERROR:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      slide: createEmergencyFallback()
    }, { status: 500 });
  }
}

async function processActionRequest(requestData, studyPlan, studentGoal) {
  const {
    requestedAction = null,
    actionContext = "",
    currentSlideIndex = 0,
    quizResults = null,
    includeImages = true,
    cognitiveLoad = "medium",
    studentInteractions = [],
    currentMistakes = []
  } = requestData;
  
  const engine = new DynamicContentEngine();
  
  if (requestedAction === 'quiz-results' && quizResults) {
    return await handleQuizResultsAnalysis(quizResults, studyPlan, studentGoal, currentSlideIndex);
  }
  
  const contentTemplate = engine.getActionTemplate(requestedAction || 'default', actionContext, studentGoal);
  
  const slideContent = await generateDynamicContent({
    studyPlan,
    studentGoal,
    cognitiveLoad,
    contentTemplate,
    requestedAction,
    actionContext,
    currentSlideIndex,
    studentInteractions,
    currentMistakes,
    includeImages
  });
  
  if (requestedAction === 'take-quiz') {
    const quizEngine = new EnhancedQuizEngine();
    const difficulty = getQuizDifficulty(cognitiveLoad, currentMistakes, studentInteractions);
    
    slideContent.quiz = await quizEngine.generateStrictQuiz(
      studyPlan.topic || "General Topic",
      actionContext || studyPlan.impTopics?.[0]?.title || "",
      5,
      difficulty,
      studentGoal
    );
    
    slideContent.metadata.quizMetadata = {
      questionCount: 5,
      difficulty: difficulty,
      adaptive: true,
      goalSpecific: true
    };
  }
  
  const availableActions = getAvailableActions({
    requestedAction,
    cognitiveLoad,
    studentGoal,
    hasMistakes: currentMistakes.length > 0,
    isQuiz: requestedAction === 'take-quiz',
    studyPlan
  });
  
  return {
    success: true,
    slide: slideContent,
    guidance: {
      availableActions,
      nextSteps: getNextSteps(requestedAction, currentMistakes, cognitiveLoad, studentGoal),
      cognitiveLoad: {
        current: cognitiveLoad,
        adjustment: getCognitiveLoadAdjustment(requestedAction, cognitiveLoad, currentMistakes.length)
      },
      sessionId: requestData.sessionId,
      goal: studentGoal
    }
  };
}

async function generateDynamicContent(config) {
  const {
    studyPlan,
    studentGoal,
    cognitiveLoad,
    contentTemplate,
    requestedAction,
    actionContext,
    currentSlideIndex,
    currentMistakes,
    includeImages = true
  } = config;
  
  const prompt = buildDynamicPrompt(config);
  
  console.log(`Generating content for: ${studyPlan.topic} (${requestedAction})`);
  
  try {
    const aiContent = await callDynamicAI(prompt, requestedAction || 'default');
    
    let slideImages = [];
    if (includeImages && requestedAction !== 'take-quiz' && requestedAction !== 'quiz-results') {
      const imageGenerator = new StrictImageGenerator();
      slideImages = await imageGenerator.generateForTopic(
        studyPlan.topic || "General Topic",
        aiContent.narrative || actionContext,
        2,
        requestedAction
      );
    }
    
    const formattedContent = {
      id: `slide-${Date.now()}-${currentSlideIndex}`,
      title: aiContent.title || getDefaultTitle(requestedAction, actionContext, studyPlan.topic),
      type: requestedAction || 'learning',
      content: aiContent,
      metadata: {
        actionType: requestedAction,
        actionContext: actionContext,
        topic: studyPlan.topic,
        goal: studentGoal,
        slideNumber: currentSlideIndex + 1,
        generatedAt: new Date().toISOString(),
        cognitiveLoad: cognitiveLoad,
        hasImages: slideImages.length > 0,
        imageCount: slideImages.length
      }
    };
    
    if (slideImages.length > 0) {
      formattedContent.images = slideImages;
    }
    
    return formattedContent;
    
  } catch (error) {
    console.warn("Using fallback content:", error.message);
    return createEnhancedFallback(config);
  }
}

async function handleQuizResultsAnalysis(quizResults, studyPlan, studentGoal, currentSlideIndex) {
  console.log("Processing quiz results analysis");
  
  try {
    const analysis = analyzeQuizResults(quizResults);
    const engine = new DynamicContentEngine();
    const contentTemplate = engine.getActionTemplate('quiz-results', '', studentGoal);
    
    const prompt = buildQuizResultsPrompt(analysis, studyPlan, studentGoal);
    const aiContent = await callDynamicAI(prompt, 'quiz-results');
    
    const slideContent = {
      id: `quiz-results-${Date.now()}-${currentSlideIndex}`,
      title: `Quiz Analysis: ${studyPlan.topic || "Recent Quiz"}`,
      type: 'quiz-results',
      content: aiContent || createQuizResultsFallback(analysis, studyPlan),
      metadata: {
        actionType: 'quiz-results',
        topic: studyPlan.topic,
        goal: studentGoal,
        slideNumber: currentSlideIndex + 1,
        generatedAt: new Date().toISOString(),
        analysis: analysis
      }
    };
    
    const availableActions = [
      { id: "continue", label: "Continue Learning", enabled: true },
      { id: "review-mistakes", label: "Review Mistakes", enabled: analysis.mistakes.length > 0 },
      { id: "challenge-quiz", label: "Take Challenge Quiz", enabled: analysis.score >= 80 },
      { id: "explain-more", label: "Deepen Understanding", enabled: true }
    ];
    
    return {
      success: true,
      slide: slideContent,
      guidance: {
        availableActions,
        nextSteps: getQuizResultsNextSteps(analysis, studentGoal),
        cognitiveLoad: {
          current: analysis.score < 60 ? 'low' : 'medium',
          reason: analysis.score < 60 ? 'Need foundational review' : 'Ready to progress'
        }
      }
    };
    
  } catch (error) {
    console.error("Quiz results error:", error);
    return {
      success: false,
      error: error.message,
      slide: createQuizResultsFallback({ score: 0, mistakes: [] }, studyPlan)
    };
  }
}

function validateStudentGoal(goal) {
  const validGoals = ['gate', 'jee', 'neet', 'semester', 'concept'];
  return validGoals.includes(goal.toLowerCase()) ? goal.toLowerCase() : 'gate';
}

function getQuizDifficulty(cognitiveLoad, currentMistakes, studentInteractions) {
  if (currentMistakes.length > 2) return 'easy';
  if (cognitiveLoad === 'high') return 'easy';
  if (cognitiveLoad === 'low') return 'hard';
  
  const recentQuizzes = studentInteractions
    .filter(i => i.type === 'quiz')
    .slice(-2);
    
  if (recentQuizzes.length > 0) {
    const avgScore = recentQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / recentQuizzes.length;
    if (avgScore >= 80) return 'hard';
    if (avgScore >= 60) return 'medium';
  }
  
  return 'medium';
}

function getAvailableActions(config) {
  const { requestedAction, cognitiveLoad, studentGoal, hasMistakes, isQuiz, studyPlan } = config;
  
  const baseActions = [
    { id: "continue", label: "Continue Learning", enabled: true, icon: "forward" },
    { id: "ask-question", label: "Ask Question", enabled: true, icon: "help" }
  ];
  
  if (!isQuiz) {
    baseActions.push({ id: "explain-more", label: "Explain More", enabled: true, icon: "zoom-in" });
  }
  
  if (!isQuiz && cognitiveLoad !== 'high') {
    baseActions.push({ id: "take-quiz", label: "Take Quiz (5 questions)", enabled: true, icon: "test" });
  }
  
  if (hasMistakes) {
    baseActions.push({ id: "review-mistakes", label: "Review Mistakes", enabled: true, icon: "review" });
  }
  
  if (cognitiveLoad === 'low' && studentGoal !== 'concept') {
    baseActions.push({ id: "challenge", label: "Challenge Mode", enabled: true, icon: "challenge" });
  }
  
  return baseActions;
}

function getNextSteps(requestedAction, currentMistakes, cognitiveLoad, studentGoal) {
  const nextSteps = [];
  
  switch (requestedAction) {
    case 'explain-more':
      nextSteps.push(
        "Try applying the concept to a different scenario",
        "Consider how this relates to previously learned concepts",
        currentMistakes.length > 0 ? "Review the specific areas you've struggled with" : "Test your understanding"
      );
      break;
      
    case 'ask-question':
      nextSteps.push(
        "Try explaining the answer in your own words",
        "Create your own example of this concept",
        "Consider other related questions that might arise"
      );
      break;
      
    case 'take-quiz':
      nextSteps.push(
        "Review incorrect answers carefully",
        "Identify patterns in mistakes",
        "Focus on concepts that need reinforcement"
      );
      break;
      
    default:
      nextSteps.push(
        "Think about real-world applications",
        "Connect to your learning goals",
        cognitiveLoad === 'medium' ? "Consider explaining this to someone else" : "Take notes on key insights"
      );
      break;
  }
  
  if (studentGoal === 'gate') {
    nextSteps.push("Practice time-bound problem solving");
  } else if (studentGoal === 'jee') {
    nextSteps.push("Try multiple solution approaches");
  } else if (studentGoal === 'neet') {
    nextSteps.push("Create visual diagrams or mnemonics");
  }
  
  return nextSteps;
}

function getCognitiveLoadAdjustment(requestedAction, currentLoad, mistakeCount) {
  if (mistakeCount > 2) return { recommended: 'lower', reason: 'Multiple mistakes indicate need for simpler content' };
  
  const adjustments = {
    'explain-more': currentLoad === 'high' ? 'lower' : 'same',
    'ask-question': 'same',
    'take-quiz': 'lower',
    'quiz-results': currentLoad === 'high' ? 'lower' : 'same',
    'default': 'same'
  };
  
  return {
    recommended: adjustments[requestedAction] || 'same',
    reason: getAdjustmentReason(requestedAction, currentLoad)
  };
}

function getAdjustmentReason(requestedAction, currentLoad) {
  const reasons = {
    'explain-more': currentLoad === 'high' 
      ? 'Simplifying for better understanding' 
      : 'Maintaining focus on details',
    'ask-question': 'Addressing specific doubts requires precision',
    'take-quiz': 'Testing mode benefits from focused attention',
    'quiz-results': 'Analysis requires clear thinking',
    'default': 'Balanced learning approach'
  };
  
  return reasons[requestedAction] || 'Optimal learning progression';
}

function getQuizResultsNextSteps(analysis, studentGoal) {
  const nextSteps = [];
  
  if (analysis.score >= 80) {
    nextSteps.push(
      "Excellent work! Consider moving to more advanced topics",
      "Challenge yourself with harder problems"
    );
  } else if (analysis.score >= 60) {
    nextSteps.push(
      "Good progress. Focus on weak areas",
      "Review key concepts before advancing"
    );
  } else {
    nextSteps.push(
      "Focus on foundational understanding",
      "Review basic concepts thoroughly"
    );
  }
  
  if (analysis.learningGaps.length > 0) {
    nextSteps.push(`Priority review: ${analysis.learningGaps[0].concept}`);
  }
  
  if (studentGoal === 'gate' && analysis.score < 70) {
    nextSteps.push("Practice time management with similar problems");
  } else if (studentGoal === 'jee' && analysis.score < 70) {
    nextSteps.push("Work on multiple solution approaches");
  }
  
  return nextSteps;
}

function getDefaultTitle(requestedAction, actionContext, topic) {
  const titles = {
    'explain-more': `Deep Dive: ${actionContext || topic}`,
    'ask-question': `Answering: ${actionContext?.substring(0, 40) || "Your Question"}...`,
    'take-quiz': `Strict Quiz: ${topic}`,
    'quiz-results': `Quiz Analysis: ${topic}`,
    'default': `Learning: ${topic}`
  };
  
  return titles[requestedAction] || `Learning: ${topic}`;
}

function buildDynamicPrompt(config) {
  const {
    studyPlan,
    studentGoal,
    cognitiveLoad,
    contentTemplate,
    requestedAction,
    actionContext,
    currentMistakes
  } = config;
  
  const goalInfo = getGoalInfo(studentGoal);
  
  let prompt = `${contentTemplate.promptTemplate}

STUDENT CONTEXT:
• Goal: ${studentGoal.toUpperCase()} - ${goalInfo.title}
• Cognitive Load: ${cognitiveLoad.toUpperCase()}
• Recent Mistakes: ${currentMistakes.length > 0 ? currentMistakes.slice(0, 3).map(m => m.concept).join(', ') : 'None noted'}

TOPIC: ${studyPlan.topic || "General Topic"}`;

  if (studyPlan.impTopics && studyPlan.impTopics.length > 0) {
    prompt += `\n\nKEY SUBTOPICS:`;
    studyPlan.impTopics.forEach((topic, i) => {
      if (typeof topic === 'string') {
        prompt += `\n${i + 1}. ${topic}`;
      } else {
        prompt += `\n${i + 1}. ${topic.title || topic}${topic.description ? ` (${topic.description})` : ''}`;
      }
    });
  }

  prompt += `\n\n${goalInfo.guidance}`;
  
  if (cognitiveLoad === 'high') {
    prompt += `\n\nCOGNITIVE LOAD HIGH: Keep explanations simple and focused on one key concept at a time.`;
  } else if (cognitiveLoad === 'low') {
    prompt += `\n\nCOGNITIVE LOAD LOW: You can explore multiple perspectives and deeper connections.`;
  }

  prompt += `\n\nRESPONSE FORMAT - Return valid JSON with appropriate fields:

IMPORTANT: Structure your response based on the action type. Include only relevant fields.

${getResponseFormatGuide(requestedAction)}`;

  return prompt;
}

function getResponseFormatGuide(actionType) {
  switch(actionType) {
    case 'explain-more':
      return `{
  "title": "Engaging explanation title",
  "narrative": "Main explanatory content as a flowing narrative",
  "keyInsights": ["Key point 1", "Key point 2", "Key point 3"],
  "analogies": [
    {
      "domain": "Familiar domain",
      "comparison": "How it compares to the concept",
      "lesson": "What we learn from this comparison"
    }
  ],
  "realWorldScenario": {
    "situation": "Real-world situation",
    "application": "How concept applies",
    "outcome": "Result/benefit"
  },
  "commonMisconceptions": ["Misconception 1", "Why it's wrong"],
  "memoryHook": "Technique to remember this concept"
}`;
      
    case 'ask-question':
      return `{
  "title": "Answer to your question",
  "directAnswer": "Clear, concise answer addressing the exact doubt",
  "detailedExplanation": "Step-by-step explanation",
  "multiplePerspectives": [
    "Perspective 1 explanation",
    "Perspective 2 explanation"
  ],
  "examples": [
    "Example 1 illustrating the concept",
    "Example 2 showing application"
  ],
  "verificationCheck": "How to confirm your understanding is correct",
  "relatedConcepts": ["Related concept 1", "Related concept 2"]
}`;
      
    case 'quiz-results':
      return `{
  "title": "Quiz Performance Analysis",
  "overview": "Brief summary of performance",
  "strengths": ["Strength 1", "Strength 2"],
  "improvementAreas": ["Area 1 to improve", "Area 2 to improve"],
  "mistakeAnalysis": [
    {
      "question": "Question that was missed",
      "correctAnswer": "What was correct",
      "whyWrong": "Why the mistake happened",
      "correctUnderstanding": "Correct way to think about it"
    }
  ],
  "personalizedRecommendations": [
    "Recommendation 1",
    "Recommendation 2",
    "Recommendation 3"
  ],
  "nextPracticeFocus": "What to practice next"
}`;
      
    default:
      return `{
  "title": "Engaging learning title",
  "narrative": "Main content in a flowing, engaging style",
  "keyInsights": ["Key insight 1", "Key insight 2"],
  "interactiveElement": "Question or activity for the student",
  "practicalApplication": "How this applies in practice",
  "examRelevance": "How this relates to exams (if applicable)",
  "nextThought": "What to think about next"
}`;
  }
}

function buildQuizResultsPrompt(analysis, studyPlan, studentGoal) {
  return `Analyze quiz performance and provide personalized feedback.

QUIZ RESULTS:
• Score: ${analysis.score}% (${analysis.totalQuestions} questions)
• Performance Level: ${analysis.performanceLevel}
• Key Learning Gaps: ${analysis.learningGaps.map(g => `${g.concept} (${g.count} mistakes)`).join(', ') || 'None identified'}

TOPIC: ${studyPlan.topic || "Recent Quiz"}
STUDENT GOAL: ${studentGoal.toUpperCase()}

ANALYSIS REQUEST:
1. **Overall Performance Summary** - Brief assessment
2. **Key Strengths** - What concepts were well understood
3. **Specific Improvement Areas** - Focus on the learning gaps
4. **Mistake Explanations** - Explain why wrong answers were incorrect
5. **Personalized Recommendations** - Based on score and gaps
6. **Goal-Specific Advice** - For ${studentGoal.toUpperCase()} preparation

FORMAT:
• Keep it concise and actionable
• Focus on 2-3 key improvement areas
• Use encouraging, constructive language
• Connect to ${studentGoal.toUpperCase()} exam relevance`;
}

function analyzeQuizResults(quizResults) {
  const score = quizResults.score || quizResults.performance?.score || 0;
  const totalQuestions = quizResults.totalQuestions || quizResults.performance?.totalQuestions || 10;
  const mistakes = quizResults.mistakes || quizResults.analysis?.knowledgeGaps || [];
  
  const mistakePatterns = {};
  mistakes.forEach(mistake => {
    const concept = mistake.concept || 'general';
    mistakePatterns[concept] = (mistakePatterns[concept] || 0) + 1;
  });
  
  const learningGaps = Object.entries(mistakePatterns)
    .map(([concept, count]) => ({
      concept,
      count,
      priority: count > 2 ? 'high' : count > 1 ? 'medium' : 'low'
    }))
    .sort((a, b) => b.count - a.count);
  
  return {
    score,
    totalQuestions,
    mistakes,
    learningGaps,
    performanceLevel: score >= 90 ? 'excellent' : 
                    score >= 80 ? 'very good' : 
                    score >= 70 ? 'good' : 
                    score >= 60 ? 'fair' : 'needs_improvement'
  };
}

function getGoalInfo(goal) {
  const goals = {
    gate: {
      title: "GATE Exam Preparation",
      guidance: "Focus on problem-solving approaches, time management, and engineering applications. Include numerical examples where relevant."
    },
    jee: {
      title: "JEE Advanced Preparation",
      guidance: "Emphasize conceptual depth, multiple solution approaches, and formula applications. Focus on fundamental understanding."
    },
    neet: {
      title: "NEET UG Preparation",
      guidance: "Use biological system connections, memorization techniques, and diagram-based learning. Focus on processes and systems."
    },
    concept: {
      title: "Concept Mastery",
      guidance: "Build from first principles with varied explanations. Focus on deep understanding rather than exam tricks."
    },
    semester: {
      title: "University Exams",
      guidance: "Focus on comprehensive understanding, theory applications, and exam-style questions."
    }
  };
  
  return goals[goal] || goals.gate;
}

async function callDynamicAI(prompt, actionType) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("API key not configured.");
  }
  
  console.log(`Calling AI for ${actionType} (prompt: ${prompt.length} chars)`);
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [
          {
            role: "system",
            content: `You are an expert educational content creator. 
            Return ONLY valid JSON in the requested format.
            Be clear, engaging, and educationally valuable.
            Tailor content to the student's goal and cognitive load.`
          },
          {
            role: "user",
            content: prompt.length > 2500 ? prompt.substring(0, 2500) + "...[truncated]" : prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText.substring(0, 200));
      throw new Error(`API responded with ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error("No content in AI response");
    }
    
    const content = data.choices[0].message.content;
    
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0].replace(/```json|```/g, '').trim() : content;
      const parsed = JSON.parse(jsonStr);
      
      console.log("AI Content Generated Successfully");
      return parsed;
    } catch (parseError) {
      console.warn("JSON parse error, creating structured content");
      return createStructuredContentFromText(content, actionType);
    }
    
  } catch (error) {
    console.error("AI call failed:", error.message);
    throw error;
  }
}

function createStructuredContentFromText(text, actionType) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const meaningfulText = lines.slice(0, 10).join('\n');
  
  let content = {
    narrative: meaningfulText || "Let's explore this important concept together.",
    keyInsights: [
      "Understanding the fundamentals is crucial",
      "Practice helps reinforce learning",
      "Application in different contexts deepens understanding"
    ]
  };
  
  if (actionType === 'explain-more') {
    content.analogies = [
      {
        domain: "Real World System",
        comparison: "Practical comparison to aid understanding",
        lesson: "Key insight about the concept"
      }
    ];
  } else if (actionType === 'ask-question') {
    content.directAnswer = "The key point is...";
    content.examples = ["Example illustrating the concept"];
  }
  
  return content;
}

function createEnhancedFallback(config) {
  const { requestedAction, actionContext, studyPlan, studentGoal } = config;
  
  const fallbacks = {
    'explain-more': {
      title: `Enhanced: ${actionContext || studyPlan.topic}`,
      content: {
        narrative: `Let's dive deeper into ${actionContext || studyPlan.topic}. This is an important concept that has many practical applications.`,
        keyInsights: [
          "The core principle is fundamental to understanding",
          "Real-world applications demonstrate its importance",
          "Common mistakes to avoid when working with this concept"
        ],
        analogies: [
          {
            domain: "Everyday System",
            comparison: "Similar to how a familiar system works",
            lesson: "This helps us understand the underlying principle"
          }
        ]
      }
    },
    
    'ask-question': {
      title: `Answering: "${actionContext?.substring(0, 50) || "Your question"}..."`,
      content: {
        directAnswer: "Based on your question, here's the key insight...",
        detailedExplanation: "Let me break this down step by step...",
        examples: [
          "For example, consider this scenario...",
          "Another way to look at it is..."
        ],
        verificationCheck: "To confirm you understand, try explaining it in your own words or applying it to a new situation."
      }
    },
    
    'take-quiz': {
      title: `Strict Quiz: ${studyPlan.topic}`,
      content: {
        narrative: "Test your understanding with these carefully crafted questions.",
        quizInstructions: "Select the best answer for each question. You'll receive detailed feedback on your answers."
      }
    },
    
    'quiz-results': {
      title: `Quiz Analysis`,
      content: {
        overview: "Review your performance to identify strengths and areas for improvement.",
        personalizedRecommendations: [
          "Focus on foundational concepts",
          "Practice application problems",
          "Review key definitions and principles"
        ]
      }
    },
    
    'default': {
      title: `Learning: ${studyPlan.topic}`,
      content: {
        narrative: `Exploring ${studyPlan.topic} through interactive learning.`,
        keyInsights: [
          "Core concepts provide the foundation for advanced topics",
          "Practical applications demonstrate real-world relevance",
          "Connecting concepts builds a stronger understanding"
        ],
        interactiveElement: "What aspect of this topic would you like to explore further?"
      }
    }
  };
  
  const fallback = fallbacks[requestedAction] || fallbacks.default;
  
  return {
    id: `fallback-${Date.now()}`,
    title: fallback.title,
    type: requestedAction || 'learning',
    content: fallback.content,
    metadata: {
      actionType: requestedAction,
      actionContext: actionContext,
      topic: studyPlan.topic,
      goal: studentGoal,
      generatedAt: new Date().toISOString(),
      isFallback: true
    }
  };
}

function createStudyPlanFallback(requestData) {
  return {
    id: `studyplan-fallback-${Date.now()}`,
    title: "Welcome to Interactive Learning",
    type: "welcome",
    content: {
      narrative: "Let's begin your learning journey. Please start by providing your learning materials or selecting a topic.",
      keyInsights: [
        "Interactive learning adapts to your needs",
        "You can ask questions at any time",
        "Quizzes help reinforce understanding"
      ],
      callToAction: "Provide your study materials or select a topic to begin."
    },
    metadata: {
      actionType: "welcome",
      generatedAt: new Date().toISOString(),
      isFallback: true,
      requiresStudyPlan: true
    }
  };
}

function createQuizResultsFallback(analysis, studyPlan) {
  return {
    overview: `You scored ${analysis.score}% on the quiz.`,
    strengths: analysis.score >= 70 ? ["Good understanding of core concepts"] : ["You're building a foundation"],
    improvementAreas: analysis.mistakes.length > 0 
      ? [`Review ${analysis.mistakes.length} specific areas`]
      : ["Continue practicing to maintain understanding"],
    personalizedRecommendations: [
      "Review the concepts you missed",
      "Practice similar problems",
      "Consider retaking the quiz after review"
    ]
  };
}

function createEmergencyFallback() {
  return {
    id: `emergency-${Date.now()}`,
    title: "Learning Content",
    type: "emergency",
    content: {
      narrative: "We're experiencing technical difficulties. Please try again or refresh the page.",
      keyInsights: [
        "Learning is a continuous process",
        "Technical issues happen occasionally",
        "Your progress is saved automatically"
      ]
    },
    metadata: {
      actionType: "emergency",
      generatedAt: new Date().toISOString(),
      isEmergency: true
    }
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const studentGoal = searchParams.get('goal') || 'gate';
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId parameter is required",
        usage: {
          POST: "Generate slides with full request body",
          GET: "Test endpoint with ?sessionId=xxx&goal=gate"
        }
      }, { status: 400 });
    }
    
    const studyPlan = getStudyPlan(sessionId);
    if (!studyPlan) {
      return NextResponse.json({
        success: false,
        error: `No study plan found for session: ${sessionId}`,
        suggestion: "First create a study plan via lecture-input"
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: "Generate-slide endpoint is working",
      sessionInfo: {
        sessionId,
        hasStudyPlan: true,
        topic: studyPlan.topic || "Unknown",
        goal: studentGoal
      },
      endpoint: {
        method: "POST",
        description: "Send JSON with requestedAction, actionContext, etc.",
        exampleBody: {
          sessionId: "your-session-id",
          studentGoal: "gate",
          requestedAction: "explain-more",
          actionContext: "Explain process synchronization",
          currentSlideIndex: 0
        }
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}