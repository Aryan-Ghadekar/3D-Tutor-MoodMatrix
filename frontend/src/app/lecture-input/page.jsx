"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../theme-provider";
import { 
  Brain, ArrowRight, Sparkles, Upload, FileText, 
  FileAudio, FileImage, X, Loader2, Mic, Youtube
} from "lucide-react";
import Header from "../../components/Header.jsx"; 

export default function LectureInputPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const [youtubeLink, setYoutubeLink] = useState("");
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const isLight = theme === "light";

    const handleProceed = async () => {
        if (!youtubeLink.trim() && files.length === 0) {
            alert("Please enter a YouTube link or upload files");
            return;
        }

        setIsUploading(true);
        
        try {
            // Create FormData for all cases
            const formData = new FormData();
            
            // Validate and process YouTube link
            if (youtubeLink.trim()) {
                const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
                if (!youtubeRegex.test(youtubeLink.trim())) {
                    alert("Please enter a valid YouTube URL.\nSupported formats:\n• https://www.youtube.com/watch?v=VIDEO_ID\n• https://youtu.be/VIDEO_ID");
                    setIsUploading(false);
                    return;
                }
                console.log("Processing YouTube link:", youtubeLink.trim());
            }
            
            // Find and validate files
            const pdfFile = files.find(file => 
                file.type === 'application/pdf' || 
                file.name.toLowerCase().endsWith('.pdf')
            );
            
            const pptFile = files.find(file => {
                const pptTypes = [
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'application/mspowerpoint',
                    'application/powerpoint'
                ];
                return pptTypes.includes(file.type) || 
                       file.name.toLowerCase().match(/\.(ppt|pptx)$/i);
            });
            
            const audioFile = files.find(file => {
                const audioTypes = [
                    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
                    'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/m4a'
                ];
                return audioTypes.includes(file.type) || 
                       file.name.toLowerCase().match(/\.(mp3|wav|m4a|ogg|webm)$/i);
            });
            
            // Validate: must have at least PDF/PPT or YouTube link
            if (!pdfFile && !pptFile && !youtubeLink.trim()) {
                alert("Please upload at least one PDF or PowerPoint file, or provide a YouTube URL.\n\nSupported formats:\n• PDF files (.pdf)\n• PowerPoint files (.ppt, .pptx)\n• Audio files (.mp3, .wav, .m4a, .ogg, .webm) - optional\n• YouTube URLs");
                setIsUploading(false);
                return;
            }
            
            // Add files to FormData (backend expects: pdf, ppt, audio)
            if (pdfFile) {
                formData.append('pdf', pdfFile);
                console.log(`Added PDF: ${pdfFile.name}`);
            }
            if (pptFile) {
                formData.append('ppt', pptFile);
                console.log(`Added PowerPoint: ${pptFile.name}`);
            }
            if (audioFile) {
                formData.append('audio', audioFile);
                console.log(`Added Audio: ${audioFile.name}`);
            }
            
            // Build URL with query parameter for YouTube link (backend expects yt_link param)
            let apiUrl = '/api/analyze-lecture';
            if (youtubeLink.trim()) {
                const encodedLink = encodeURIComponent(youtubeLink.trim());
                apiUrl += `?yt_link=${encodedLink}`;
                console.log("API URL with YouTube:", apiUrl);
            }
            
            console.log("Sending request to FastAPI backend...");
            
            // Send to FastAPI backend
            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
                // Don't set Content-Type - browser handles it for FormData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const lecturePlan = await response.json();
            console.log('Lecture plan received:', lecturePlan);
            
            // Validate response structure (backend returns direct plan object)
            if (!lecturePlan || !lecturePlan.impTopics || lecturePlan.impTopics.length === 0) {
                throw new Error('Invalid response: No topics generated. Check backend logs.');
            }
            
            // Invalidate cached lecture plan for ANY new content (PDF, PPT, audio, YouTube)
            localStorage.setItem('force_lecture_plan_refresh', 'true');
            console.log('Cache invalidated - new content uploaded (PDF/PPT/Audio/YouTube)');
            
            const sessionId = lecturePlan.sessionId || `session_${Date.now()}`;
            const lectureId = lecturePlan.lectureId || `lecture_${Date.now()}`;
            
            console.log('Generated IDs:', { sessionId, lectureId });
            console.log('Topics generated:', lecturePlan.impTopics.length);
            
            // Save to localStorage
            localStorage.setItem('lectureData', JSON.stringify({
                content: youtubeLink.trim() ? "YouTube video content" : "Uploaded files content",
                lecturePlan: lecturePlan,
                videoUrl: youtubeLink.trim() || null,
                files: files.map(f => f.name),
                timestamp: new Date().toISOString(),
                sessionId: sessionId
            }));
            
            console.log('Data saved to localStorage. Navigating...');
            
            // Teachers go on to start a live class; students take the knowledge test
            const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({ user: null }));
            const next = me.user?.role === 'teacher'
                ? '/teacher'
                : `/knowledge-test?lectureId=${lectureId}&sessionId=${sessionId}`;
            setTimeout(() => router.push(next), 500);
            
        } catch (error) {
            console.error('Processing failed:', error);
            alert(`Error: ${error.message}\n\nPlease check:\n1. Backend is running on correct port\n2. Files are valid formats\n3. YouTube link is correct\n\nCheck console for details.`);
            setIsUploading(false);
        }
    };

    const handleFileSelect = (selectedFiles) => {
        const validFiles = Array.from(selectedFiles).filter(file => {
            const validTypes = [
                // Audio files
                'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/mp3', 
                'audio/webm', 'audio/m4a', 'audio/x-wav',
                // Document files
                'application/pdf', 
                'application/vnd.ms-powerpoint', 
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'application/mspowerpoint',
                'application/powerpoint',
                // Image files (optional)
                'image/png', 'image/jpeg', 'image/gif', 'image/webp'
            ];
            const maxSize = 50 * 1024 * 1024; // 50MB
            
            // Check by MIME type or file extension
            const isValidType = validTypes.includes(file.type);
            const isValidExtension = file.name.toLowerCase().match(/\.(pdf|ppt|pptx|mp3|wav|m4a|mp4|ogg|webm|png|jpg|jpeg|gif|webp)$/i);
            
            if (!isValidType && !isValidExtension) {
                alert(`Unsupported file: ${file.name}\nType: ${file.type}\n\nSupported: PDF, PPT, PPTX, MP3, WAV, M4A, OGG, WEBM`);
                return false;
            }
            
            if (file.size > maxSize) {
                alert(`File too large: ${file.name}\nSize: ${(file.size / (1024 * 1024)).toFixed(2)}MB\nMax: 50MB`);
                return false;
            }
            
            return true;
        });
        
        setFiles(prev => [...prev, ...validFiles]);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('audio/')) return <FileAudio className="w-4 h-4" />;
        if (fileType === 'application/pdf') return <FileText className="w-4 h-4" />;
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) 
            return <FileImage className="w-4 h-4" />;
        if (fileType.startsWith('image/')) return <FileImage className="w-4 h-4" />;
        return <FileText className="w-4 h-4" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <Header />
            
            <main className="pt-16 h-[calc(100vh-64px)] flex flex-col items-center justify-center p-4 md:p-6">
                <div className={`w-full max-w-md p-5 md:p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300
                    ${isLight
                        ? "bg-white/70 border-white/50 shadow-xl"
                        : "bg-gray-900/40 border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.3)]"
                    }`}
                >
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className={`w-12 h-12 md:w-14 md:h-14 mb-3 md:mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ${!isUploading && 'animate-pulse'}`}>
                            {isUploading ? (
                                <Loader2 className="w-6 h-6 md:w-7 md:h-7 text-white animate-spin" />
                            ) : (
                                <Brain className="w-6 h-6 md:w-7 md:h-7 text-white" />
                            )}
                        </div>
                        <h2 className={`text-2xl md:text-3xl font-bold mb-1 md:mb-2 ${isLight ? "text-gray-900" : "text-white"}`}>
                            Ready to learn?
                        </h2>
                        <p className={`${isLight ? "text-gray-600" : "text-gray-400"} text-sm md:text-base max-w-sm`}>
                            Upload PDF/PowerPoint or YouTube link + optional audio
                        </p>
                        <p className={`${isLight ? "text-gray-500" : "text-gray-500"} text-xs mt-2`}>
                            <span className="text-green-500">✅</span> PDF • PPT • YouTube • Audio
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* YouTube Link Input */}
                        <div className="relative group">
                            <input
                                type="text"
                                value={youtubeLink}
                                onChange={(e) => setYoutubeLink(e.target.value)}
                                placeholder="Paste YouTube link here..."
                                className={`w-full px-4 py-3 md:py-3.5 rounded-xl text-sm md:text-base outline-none transition-all duration-300 border
                                    ${isLight
                                        ? "bg-gray-100 border-gray-300 text-gray-900 focus:border-blue-500 focus:bg-white"
                                        : "bg-gray-800/30 border-gray-700 text-gray-100 focus:border-purple-500"
                                    }`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Youtube className={`w-4 h-4 md:w-5 md:h-5 ${youtubeLink ? 'text-red-500' : isLight ? "text-gray-400" : "text-gray-500"}`} />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative flex items-center justify-center">
                            <div className={`flex-grow h-px ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`}></div>
                            <span className={`px-3 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>OR</span>
                            <div className={`flex-grow h-px ${isLight ? 'bg-gray-300' : 'bg-gray-700'}`}></div>
                        </div>

                        {/* File Upload Area */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-4 text-center transition-all duration-300 cursor-pointer
                                ${isDragging 
                                    ? isLight 
                                        ? 'border-blue-500 bg-blue-50/50' 
                                        : 'border-purple-500 bg-purple-900/20'
                                    : isLight 
                                        ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30' 
                                        : 'border-gray-700 hover:border-purple-400 hover:bg-purple-900/10'
                                }`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                accept=".mp3,.wav,.m4a,.ogg,.mp4,.webm,.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
                                onChange={(e) => handleFileSelect(e.target.files)}
                            />
                            
                            <div className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2
                                    ${isLight 
                                        ? 'bg-blue-100 text-blue-600' 
                                        : 'bg-purple-900/30 text-purple-400'
                                    }`}
                                >
                                    <Upload className="w-5 h-5" />
                                </div>
                                
                                <p className={`text-sm font-medium mb-1 ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                                    Drop files or click to upload
                                </p>
                                
                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    PDF/PPT + Audio (optional)
                                </p>
                            </div>
                        </div>

                        {/* File List */}
                        {files.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <h3 className={`font-medium text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                        Files ({files.length})
                                    </h3>
                                    <div className={`text-xs px-2 py-1 rounded-full ${
                                        files.some(f => f.type === 'application/pdf' || f.type.includes('powerpoint') || f.type.includes('presentation'))
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                        {files.some(f => f.type === 'application/pdf' || f.type.includes('powerpoint') || f.type.includes('presentation'))
                                            ? 'Ready' 
                                            : 'Need PDF/PPT'}
                                    </div>
                                </div>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-between p-2 rounded-lg transition-all border
                                                ${file.type === 'application/pdf' || file.type.includes('powerpoint') || file.type.includes('presentation')
                                                    ? isLight
                                                        ? 'bg-blue-50/50 border-blue-200'
                                                        : 'bg-blue-900/20 border-blue-800'
                                                    : isLight
                                                        ? 'bg-white border border-gray-200'
                                                        : 'bg-gray-800/50 border border-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className={`p-1.5 rounded-md flex-shrink-0
                                                    ${file.type === 'application/pdf' || file.type.includes('powerpoint') || file.type.includes('presentation')
                                                        ? isLight ? 'bg-blue-100' : 'bg-blue-800'
                                                        : isLight ? 'bg-gray-100' : 'bg-gray-800'
                                                    }`}
                                                >
                                                    {getFileIcon(file.type)}
                                                </div>
                                                <div className="text-left min-w-0 flex-1">
                                                    <p className={`font-medium truncate text-sm
                                                        ${isLight ? 'text-gray-800' : 'text-gray-200'}
                                                    `}>
                                                        {file.name}
                                                    </p>
                                                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {formatFileSize(file.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeFile(index);
                                                }}
                                                className={`p-1 rounded-full hover:scale-110 transition-transform flex-shrink-0
                                                    ${isLight
                                                        ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                                                        : 'text-gray-400 hover:text-red-400 hover:bg-red-900/20'
                                                    }`}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            onClick={handleProceed}
                            disabled={(!youtubeLink.trim() && files.length === 0) || isUploading}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                                ${isLight
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-blue-200"
                                    : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-purple-900/30"
                                }`}
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Generate Study Session
                                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Features */}
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLight ? "bg-green-500" : "bg-green-400"}`} />
                            AI Powered
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <FileText className="w-3 h-3" />
                            PDF/PPT
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <Youtube className="w-3 h-3" />
                            YouTube
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <Mic className="w-3 h-3" />
                            Audio
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}