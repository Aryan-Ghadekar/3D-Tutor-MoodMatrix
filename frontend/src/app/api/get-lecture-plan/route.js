import { NextResponse } from 'next/server';
import { storeStudyPlan } from '@/lib/study-plan-storage';

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

export async function POST(request) {
  try {
    console.log('Receiving lecture materials...');
    
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      console.error('Invalid Content-Type:', contentType);
      return NextResponse.json(
        { 
          error: 'Content-Type must be multipart/form-data',
          receivedType: contentType 
        },
        { status: 415 }
      );
    }
    
    const formData = await request.formData();
    const pdfFile = formData.get('pdf');
    const audioFile = formData.get('audio');
    
    if (!pdfFile || pdfFile.size === 0) {
      return NextResponse.json(
        { error: 'PDF file is required and cannot be empty' },
        { status: 400 }
      );
    }
    
    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a valid PDF (application/pdf)' },
        { status: 400 }
      );
    }
    
    console.log(`PDF received: ${pdfFile.name} (${(pdfFile.size / 1024).toFixed(2)} KB)`);
    
    const fastapiFormData = new FormData();
    fastapiFormData.append('pdf', pdfFile);
    
    let hasAudio = false;
    if (audioFile && audioFile.size > 0) {
      const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/mp3', 'audio/x-m4a'];
      if (audioTypes.includes(audioFile.type)) {
        fastapiFormData.append('audio', audioFile);
        hasAudio = true;
        console.log(`Audio received: ${audioFile.name} (${(audioFile.size / 1024).toFixed(2)} KB)`);
      } else {
        console.warn(`Unsupported audio type: ${audioFile.type}`);
      }
    }
    
    console.log('Calling FastAPI service...');
    console.log(`URL: ${FASTAPI_URL}/analyze-lecture`);
    
    const response = await fetch(`${FASTAPI_URL}/analyze-lecture`, {
      method: 'POST',
      body: fastapiFormData,
      headers: {
        'Accept': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')
        })
      }
    });
    
    console.log(`FastAPI response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
      } catch {
        errorText = 'No error details available';
      }
      
      console.error('FastAPI error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend service failed to process the request',
          status: response.status,
          details: errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText
        },
        { status: response.status }
      );
    }
    
    let fastapiResponse;
    try {
      fastapiResponse = await response.json();
      console.log('Study plan received from FastAPI');
    } catch (parseError) {
      console.error('Failed to parse FastAPI response:', parseError);
      throw new Error('Invalid response format from backend service');
    }
    
    if (!fastapiResponse.sessionId) {
      console.error('FastAPI response missing sessionId');
      throw new Error('Backend service did not return a session ID');
    }
    
    const sessionId = fastapiResponse.sessionId;
    
    const studyPlanToStore = {
      ...fastapiResponse,
      metadata: {
        ...fastapiResponse.metadata,
        receivedAt: new Date().toISOString(),
        hasAudio: hasAudio,
        source: 'fastapi',
        pdfFileName: pdfFile.name,
        pdfSize: pdfFile.size,
        audioSize: audioFile?.size || 0
      }
    };
    
    storeStudyPlan(sessionId, studyPlanToStore);
    
    console.log(`Stored study plan with session ID: ${sessionId}`);
    
    return NextResponse.json({
      success: true,
      studyPlan: studyPlanToStore,
      sessionId: sessionId,
      metadata: {
        generatedAt: new Date().toISOString(),
        topicsCount: fastapiResponse.impTopics?.length || 0,
        hasAudio: hasAudio,
        source: 'fastapi',
        pdfSize: pdfFile.size,
        audioSize: audioFile?.size || 0,
        processingTime: new Date().toISOString()
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
    
  } catch (error) {
    console.error('Lecture plan generation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate study plan',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        type: error.name
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}