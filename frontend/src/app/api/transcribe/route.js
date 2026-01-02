import { NextResponse } from 'next/server';

const YT_TRANSCRIBER_URL = process.env.YT_TRANSCRIBER_URL || 'http://localhost:5001';

export async function POST(request) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }
    
    // Forward request to Python server
    const response = await fetch(`${YT_TRANSCRIBER_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    
    // Return the response from Python server
    return NextResponse.json(data, { status: response.status });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to transcription service' },
      { status: 503 }
    );
  }
}