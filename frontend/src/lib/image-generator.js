// src/lib/image-generator.js - COMPLETE REGENERATED FILE

const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";
const CLIP_API_URL = process.env.CLIP_API_URL || "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32";

class ImageGenerator {
  constructor() {
    this.imageCache = new Map();
    this.baseURL = process.env.NEXT_PUBLIC_IMAGE_SERVER_URL || 'http://localhost:8001';
    this.educationalGenerator = new EducationalImageGenerator();
    this.maxImagesPerQuery = 10;
    this.minRelevanceScore = 0.7;
  }

  async getImageForConcept(concept, options = {}) {
    // Generate cache key
    const cacheKey = `${concept}_${JSON.stringify(options)}`;
    
    // Check cache first (client-side only)
    if (typeof window !== 'undefined' && this.imageCache.has(cacheKey)) {
      const cached = this.imageCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hour cache
        return cached;
      }
    }

    try {
      // First try image server
      const image = await this.fetchFromImageServer(concept, options);
      
      if (image && image.url && !image.isPlaceholder) {
        // Cache the result
        if (typeof window !== 'undefined') {
          this.imageCache.set(cacheKey, {
            ...image,
            timestamp: Date.now(),
            source: 'image_server'
          });
        }
        return image;
      }

      // Fallback to placeholder or conceptual diagram
      const fallback = this.generateConceptualImage(concept, options);
      
      if (typeof window !== 'undefined') {
        this.imageCache.set(cacheKey, {
          ...fallback,
          timestamp: Date.now(),
          source: 'generated'
        });
      }
      
      return fallback;

    } catch (error) {
      console.error('Error fetching image:', error);
      return this.generateConceptualImage(concept, options);
    }
  }

  async fetchFromImageServer(concept, options) {
    try {
      const query = this.buildImageQuery(concept, options);
      
      const response = await fetch(`${this.baseURL}/search_image?query=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.image_url && !data.image_url.includes('placeholder.com')) {
          return {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: data.image_url,
            altText: `Diagram of ${concept}`,
            title: `Visual representation: ${concept}`,
            caption: options.caption || `Illustration for better understanding of ${concept}`,
            source: data.source || 'wikimedia',
            query: query,
            isPlaceholder: false,
            optimized: data.optimized || false
          };
        }
      }
    } catch (error) {
      console.warn('Image server unavailable:', error.message);
    }

    return null;
  }

  buildImageQuery(concept, options) {
    let query = concept;
    
    if (options.category) {
      query += ` ${options.category} diagram`;
    }
    
    if (options.difficulty === 'beginner') {
      query += ' simple illustration educational';
    } else if (options.difficulty === 'advanced') {
      query += ' detailed technical schematic';
    }
    
    if (options.studentGoal === 'neet') {
      query += ' medical biological';
    } else if (options.studentGoal === 'gate') {
      query += ' engineering computer science';
    } else if (options.studentGoal === 'jee') {
      query += ' physics mathematics';
    }
    
    query += ' educational diagram infographic';
    
    return query;
  }

  generateConceptualImage(concept, options) {
    // Create a simple data URL for a conceptual diagram
    return {
      id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: `https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=${encodeURIComponent(concept.substring(0, 30))}`,
      altText: `Conceptual diagram of ${concept}`,
      title: `Conceptual representation: ${concept}`,
      caption: options.caption || `Visual aid to understand ${concept}`,
      source: 'generated',
      isPlaceholder: true,
      isSVG: false,
      colors: {
        primary: '#4F46E5',
        secondary: '#10B981',
        accent: '#F59E0B'
      },
      diagramType: 'concept_map'
    };
  }

  async batchGetImages(concepts, options = {}) {
    const results = {};
    
    for (const concept of concepts) {
      try {
        const image = await this.getImageForConcept(concept, options);
        results[concept] = image;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error getting image for ${concept}:`, error);
        results[concept] = this.generateConceptualImage(concept, options);
      }
    }
    
    return results;
  }

  clearCache() {
    this.imageCache.clear();
  }

  getCacheStats() {
    const imageCacheValues = Array.from(this.imageCache.values());
    
    return {
      size: this.imageCache.size,
      hits: imageCacheValues.filter(img => img.source === 'image_server').length,
      generated: imageCacheValues.filter(img => img.source === 'generated').length
    };
  }

  // New method to get multiple educational images
  async getEducationalImages(topic, count = 3, context = "") {
    return this.educationalGenerator.generateForTopic(topic, context, count);
  }
}

/**
 * Generate educational images from Wikimedia Commons with CLIP verification
 */
class EducationalImageGenerator {
  constructor() {
    this.maxImagesPerQuery = 10;
    this.minRelevanceScore = 0.7; // CLIP similarity threshold
    this.cache = new Map(); // Simple in-memory cache
  }

  /**
   * Main method to get relevant educational images
   */
  async generateForTopic(topic, context = "", count = 3) {
    console.log(`Generating images for: "${topic}"`);
    
    try {
      // Step 1: Generate search queries from topic
      const searchQueries = this.generateSearchQueries(topic, context);
      
      // Step 2: Search Wikimedia Commons
      const imageCandidates = await this.searchWikimedia(searchQueries);
      
      if (imageCandidates.length === 0) {
        console.log("No images found on Wikimedia Commons, using fallback");
        return this.getFallbackImages(topic);
      }
      
      // Step 3: Filter with CLIP verification
      const verifiedImages = await this.verifyWithCLIP(
        imageCandidates, 
        topic, 
        context
      );
      
      // Step 4: Select best images
      const selectedImages = this.selectBestImages(verifiedImages, count);
      
      // Step 5: Format for educational use
      return this.formatForEducationalUse(selectedImages, topic);
      
    } catch (error) {
      console.error("Image generation failed:", error.message);
      return this.getFallbackImages(topic);
    }
  }

  /**
   * Generate intelligent search queries based on topic and context
   */
  generateSearchQueries(topic, context = "") {
    const queries = [];
    
    // Main topic query
    queries.push(topic);
    
    // Add educational-specific terms
    const educationalTerms = [
      "diagram", "chart", "graph", "illustration", 
      "infographic", "schematic", "flowchart", "process",
      "concept map", "visualization", "educational"
    ];
    
    // Combine with educational terms
    educationalTerms.forEach(term => {
      queries.push(`${topic} ${term}`);
      queries.push(`${term} of ${topic}`);
    });
    
    // Extract key terms from context if provided
    if (context) {
      const keyTerms = this.extractKeyTermsFromContext(context);
      keyTerms.forEach(term => {
        queries.push(`${topic} ${term}`);
        if (term.length > 3) { // Avoid very short terms
          queries.push(term);
        }
      });
    }
    
    // Add domain-specific queries for common CS topics
    const domainSpecific = this.getDomainSpecificQueries(topic);
    queries.push(...domainSpecific);
    
    // Remove duplicates and return
    return [...new Set(queries)].slice(0, 15); // Limit queries
  }

  /**
   * Search Wikimedia Commons API
   */
  async searchWikimedia(searchQueries) {
    const allImages = [];
    
    for (const query of searchQueries) {
      try {
        console.log(`🔍 Searching Wikimedia for: "${query}"`);
        
        const params = new URLSearchParams({
          action: 'query',
          format: 'json',
          generator: 'search',
          gsrsearch: `filetype:bitmap|drawing ${query}`,
          gsrnamespace: '6', // File namespace
          gsrlimit: this.maxImagesPerQuery.toString(),
          prop: 'imageinfo|pageimages',
          iiprop: 'url|size|mime|extmetadata',
          iiurlwidth: '800', // Optimized for educational display
          piprop: 'thumbnail',
          pithumbsize: '300',
          origin: '*'
        });
        
        const response = await fetch(`${WIKIMEDIA_API_URL}?${params}`, {
          headers: {
            'User-Agent': 'EducationalApp/1.0 (https://yourapp.com)'
          }
        });
        
        if (!response.ok) {
          console.warn(`Wikimedia API error for "${query}": ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        const images = this.parseWikimediaResponse(data, query);
        
        allImages.push(...images);
        
        // Early exit if we have enough images
        if (allImages.length >= this.maxImagesPerQuery * 3) {
          break;
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`Search failed for "${query}":`, error.message);
      }
    }
    
    return allImages;
  }

  /**
   * Parse Wikimedia API response
   */
  parseWikimediaResponse(data, query) {
    const images = [];
    
    if (!data.query || !data.query.pages) {
      return images;
    }
    
    Object.values(data.query.pages).forEach(page => {
      if (!page.imageinfo || !page.imageinfo[0]) return;
      
      const imageInfo = page.imageinfo[0];
      const metadata = imageInfo.extmetadata || {};
      
      // Filter for educational content
      if (!this.isEducationalImage(metadata, imageInfo)) {
        return;
      }
      
      const image = {
        id: page.pageid,
        title: page.title?.replace('File:', '') || 'Untitled',
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
      
      // Calculate quality score
      image.qualityScore = this.calculateQualityScore(image, metadata);
      
      images.push(image);
    });
    
    return images;
  }

  /**
   * Verify images with CLIP for relevance
   */
  async verifyWithCLIP(images, topic, context) {
    console.log(`Verifying ${images.length} images with CLIP...`);
    
    const verifiedImages = [];
    
    for (const image of images) {
      try {
        // Skip if already in cache
        const cacheKey = `${image.id}_${topic}`;
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          if (cached.score >= this.minRelevanceScore) {
            verifiedImages.push({ ...image, ...cached });
          }
          continue;
        }
        
        // Prepare CLIP input
        const clipInput = {
          inputs: {
            image_url: image.url,
            texts: [
              topic,
              context,
              `educational diagram about ${topic}`,
              `computer science concept ${topic}`,
              `visual explanation of ${topic}`
            ]
          }
        };
        
        // Call CLIP API
        const response = await fetch(CLIP_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(clipInput)
        });
        
        if (!response.ok) {
          console.warn(`CLIP API error: ${response.status}`);
          continue;
        }
        
        const scores = await response.json();
        
        // Calculate relevance score (average of all text scores)
        const relevanceScore = Array.isArray(scores) && scores.length > 0
          ? scores.reduce((sum, arr) => sum + Math.max(...arr), 0) / scores.length
          : 0;
        
        const verificationResult = {
          relevanceScore: relevanceScore,
          verifiedAt: new Date().toISOString(),
          isRelevant: relevanceScore >= this.minRelevanceScore
        };
        
        // Cache result
        this.cache.set(cacheKey, verificationResult);
        
        if (verificationResult.isRelevant) {
          verifiedImages.push({
            ...image,
            ...verificationResult
          });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`CLIP verification failed for image ${image.id}:`, error.message);
      }
    }
    
    console.log(`CLIP verification complete: ${verifiedImages.length} relevant images`);
    return verifiedImages;
  }

  /**
   * Select best images based on multiple criteria
   */
  selectBestImages(images, count) {
    return images
      .sort((a, b) => {
        // Primary: CLIP relevance score
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Secondary: Image quality score
        if (b.qualityScore !== a.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }
        // Tertiary: Image dimensions (prefer larger images)
        return (b.width * b.height) - (a.width * a.height);
      })
      .slice(0, count);
  }

  /**
   * Format images for educational use
   */
  formatForEducationalUse(images, topic) {
    return images.map((image, index) => ({
      type: 'educational_image',
      id: `img_${Date.now()}_${index}`,
      source: 'wikimedia_commons',
      url: image.url,
      thumbnail: image.url, // Same URL as Wikimedia provides thumbnails
      originalUrl: image.originalUrl,
      title: image.title,
      description: image.description || `Illustration of ${topic}`,
      caption: this.generateEducationalCaption(image, topic),
      altText: this.generateAltText(image, topic),
      author: image.author,
      license: image.license,
      relevanceScore: image.relevanceScore,
      usageGuidelines: this.getUsageGuidelines(image.license),
      educationalPurpose: this.determineEducationalPurpose(image, topic),
      suggestedPlacement: index === 0 ? 'hero' : 'inline',
      metadata: {
        dimensions: `${image.width}x${image.height}`,
        fileType: image.mime,
        categories: image.categories,
        sourceQuery: image.searchQuery
      }
    }));
  }

  /**
   * Generate educational caption
   */
  generateEducationalCaption(image, topic) {
    const base = image.description 
      ? `${image.description}. `
      : `Illustration showing ${topic}. `;
    
    return `${base}This visual aid helps explain the concept of ${topic} in computer science.`;
  }

  /**
   * Generate accessibility alt text
   */
  generateAltText(image, topic) {
    if (image.description && image.description.length > 20) {
      return `Diagram: ${image.description}. Related to ${topic}.`;
    }
    
    const imageType = image.title.toLowerCase().includes('diagram') ? 'Diagram' :
                     image.title.toLowerCase().includes('chart') ? 'Chart' :
                     image.title.toLowerCase().includes('graph') ? 'Graph' :
                     'Illustration';
    
    return `${imageType} illustrating the concept of ${topic} in operating systems and process synchronization.`;
  }

  /**
   * Get usage guidelines based on license
   */
  getUsageGuidelines(license) {
    const guidelines = {
      'CC BY-SA': 'Requires attribution and share-alike',
      'CC BY': 'Requires attribution',
      'CC0': 'Public domain, no restrictions',
      'PD': 'Public domain',
      'GFDL': 'GNU Free Documentation License'
    };
    
    return guidelines[license] || 'Check specific license terms';
  }

  /**
   * Determine educational purpose of image
   */
  determineEducationalPurpose(image, topic) {
    const title = image.title.toLowerCase();
    const desc = image.description.toLowerCase();
    
    if (title.includes('diagram') || desc.includes('diagram')) {
      return 'concept_visualization';
    } else if (title.includes('chart') || desc.includes('chart')) {
      return 'data_representation';
    } else if (title.includes('flow') || desc.includes('flow')) {
      return 'process_flow';
    } else if (title.includes('architecture') || desc.includes('architecture')) {
      return 'system_architecture';
    } else if (title.includes('comparison') || desc.includes('comparison')) {
      return 'comparison_analysis';
    } else {
      return 'general_illustration';
    }
  }

  /**
   * Calculate quality score for images
   */
  calculateQualityScore(image, metadata) {
    let score = 0.5; // Base score
    
    // Resolution quality
    if (image.width >= 800 && image.height >= 600) score += 0.2;
    if (image.width >= 1200 && image.height >= 800) score += 0.1;
    
    // Metadata completeness
    if (metadata.ImageDescription?.value) score += 0.1;
    if (metadata.Artist?.value) score += 0.05;
    if (metadata.LicenseShortName?.value) score += 0.05;
    
    // Educational relevance
    const hasEducationalTerms = ['diagram', 'chart', 'graph', 'illustration', 'educational']
      .some(term => image.title.toLowerCase().includes(term) || 
                   image.description.toLowerCase().includes(term));
    if (hasEducationalTerms) score += 0.1;
    
    // File format (prefer SVG for diagrams)
    if (image.mime === 'image/svg+xml') score += 0.2;
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Check if image is educational
   */
  isEducationalImage(metadata, imageInfo) {
    // Skip non-image files
    if (!imageInfo.mime?.startsWith('image/')) return false;
    
    // Skip very small images
    if (imageInfo.width < 300 || imageInfo.height < 200) return false;
    
    // Skip inappropriate categories
    const categories = metadata.Categories?.value?.toLowerCase() || '';
    const blockedTerms = ['porn', 'adult', 'offensive', 'violence', 'person', 'portrait', 'selfie'];
    if (blockedTerms.some(term => categories.includes(term))) return false;
    
    // Check file name for educational terms
    const fileName = metadata.ObjectName?.value?.toLowerCase() || '';
    const educationalTerms = ['diagram', 'chart', 'graph', 'illustration', 'infographic', 'schematic'];
    
    return educationalTerms.some(term => 
      fileName.includes(term) || 
      categories.includes(term)
    );
  }

  /**
   * Extract key terms from context
   */
  extractKeyTermsFromContext(context) {
    const terms = [];
    
    // Simple extraction - can be enhanced with NLP
    const words = context.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from']);
    
    words.forEach(word => {
      if (word.length > 4 && !stopWords.has(word)) {
        terms.push(word);
      }
    });
    
    return [...new Set(terms)].slice(0, 10);
  }

  /**
   * Get domain-specific queries
   */
  getDomainSpecificQueries(topic) {
    const domainMap = {
      'process synchronization': [
        'process state diagram',
        'critical section problem',
        'semaphore operation',
        'deadlock detection'
      ],
      'operating system': [
        'OS architecture diagram',
        'memory management',
        'CPU scheduling',
        'file system structure'
      ],
      'algorithm': [
        'algorithm flowchart',
        'data structure diagram',
        'sorting algorithm visualization',
        'search algorithm'
      ]
    };
    
    const lowerTopic = topic.toLowerCase();
    for (const [key, queries] of Object.entries(domainMap)) {
      if (lowerTopic.includes(key)) {
        return queries;
      }
    }
    
    return [];
  }

  /**
   * Fallback images when Wikimedia search fails
   */
  getFallbackImages(topic) {
    console.log(`Using fallback images for: "${topic}"`);
    
    // Return simple placeholder structure
    return [{
      type: 'placeholder',
      id: 'fallback_img',
      url: null,
      title: `Visual aid for ${topic}`,
      description: `Diagram illustrating ${topic}`,
      caption: `This area would show a diagram explaining ${topic}.`,
      altText: `Conceptual diagram for ${topic}`,
      source: 'fallback',
      isPlaceholder: true,
      suggestedAction: 'Request specific diagram from instructor'
    }];
  }
}

export default ImageGenerator;