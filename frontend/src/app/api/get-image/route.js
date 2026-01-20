// src/app/api/get-image/route.js - COMPLETE NEW FILE

import { NextResponse } from 'next/server';
import { EducationalImageGenerator } from '@/lib/image-generator';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const context = searchParams.get('context') || '';
    const count = parseInt(searchParams.get('count') || '3');
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic parameter is required' },
        { status: 400 }
      );
    }
    
    const generator = new EducationalImageGenerator();
    const images = await generator.generateForTopic(topic, context, count);
    
    return NextResponse.json({
      success: true,
      topic: topic,
      count: images.length,
      images: images,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Image API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      images: [],
      generatedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic, context = '', count = 3, concepts = [] } = body;
    
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required in request body' },
        { status: 400 }
      );
    }
    
    const generator = new EducationalImageGenerator();
    const images = await generator.generateForTopic(topic, context, count);
    
    // Add concept relevance if concepts provided
    if (concepts.length > 0 && images.length > 0) {
      const verifier = new CLIPImageVerifier();
      const verificationResults = await verifier.batchVerify(
        images.map(img => ({
          imageId: img.id,
          imageUrl: img.url,
          concepts: concepts
        }))
      );
      
      // Merge verification results
      images.forEach((img, index) => {
        if (verificationResults[index]) {
          img.verification = verificationResults[index];
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      topic: topic,
      concepts: concepts,
      count: images.length,
      images: images,
      metadata: {
        source: 'wikimedia_commons',
        verification: concepts.length > 0 ? 'CLIP_verified' : 'basic',
        cacheStatus: 'miss' // Could implement cache tracking
      }
    });
    
  } catch (error) {
    console.error('Image POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      images: [],
      fallback: true
    }, { status: 500 });
  }
}