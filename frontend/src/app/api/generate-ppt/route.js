import { NextResponse } from 'next/server';

const OPENROUTER_API_KEY = "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";

export async function POST(req) {
    try {
        const { topic } = await req.json();
        console.log(`Generating real AI PPT for topic: ${topic}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Scholio Physics Tutor",
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b:free",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Physics and Science educator. Generate a structured JSON presentation for the topic provided.
                        
                        The output MUST be a valid JSON array of exactly 8 slides.
                        
                        Each slide must adhere to this "mixed" content schema:
                        
                        - type: "mixed"
                        - title: string (Slide Title)
                        - content: {
                            items: Array<ContentItem>
                          }
                        
                        Where ContentItem can be one of:
                        - { type: "text", title: string, bulletPoints: string[] }
                        - { type: "code", code: string, language: string }
                        - { type: "image", keywords: string[], caption: string }
                        - { type: "chart", title: string, chartType: "bar"|"line"|"area", data: Array<{name:string, value:number}> }
                        - { type: "formula", latex: string }
                        
                        Constraints:
                        1. EVERY slide must be type "mixed".
                        2. Include at least 2-3 items per slide (e.g., text + image, text + formula, text + chart).
                        3. Ensure LaTeX is valid and escaped (e.g., "\\\\frac{1}{2}").
                        4. Return ONLY the JSON array.`
                    },
                    {
                        role: "user",
                        content: `Generate a comprehensive physics presentation about: ${topic}. Make sure to generate exactly 8 slides.`
                    }
                ],
            })
        });

        const data = await response.json();

        if (!data.choices || !data.choices[0]) {
            console.error("OpenRouter Error Data:", data);
            throw new Error("Invalid response from OpenRouter");
        }

        let slidesContent = data.choices[0].message.content;

        // Clean up markdown if AI includes it
        if (slidesContent.includes('```json')) {
            slidesContent = slidesContent.split('```json')[1].split('```')[0].trim();
        } else if (slidesContent.includes('```')) {
            slidesContent = slidesContent.split('```')[1].split('```')[0].trim();
        }

        const slides = JSON.parse(slidesContent);

        // Add IDs and ensure required fields
        const formattedSlides = slides.map((slide, index) => ({
            id: index + 1,
            type: slide.type || 'text',
            content: slide.content,
            position: slide.position || {
                x: (Math.random() - 0.5) * 500,
                y: (Math.random() - 0.5) * 300
            }
        }));

        return NextResponse.json({ success: true, slides: formattedSlides });

    } catch (error) {
        console.error("AI Generation Error:", error);
        // Fallback to minimal data if AI fails
        return NextResponse.json({
            success: false,
            error: error.message,
            slides: [
                {
                    id: 1,
                    type: "text",
                    content: { title: "Error Generating Content", bulletPoints: ["The AI service is currently unavailable.", "Please check your connectivity or try again."] },
                    position: { x: 0, y: 0 }
                }
            ]
        }, { status: 500 });
    }
}
