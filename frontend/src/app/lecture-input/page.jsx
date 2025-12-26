"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../theme-provider";
import { 
  Brain, ArrowRight, Sparkles, Upload, FileText, 
  FileAudio, FileImage, X, Loader2, Mic
} from "lucide-react";
import Header from "../../components/Header.jsx"; 

export default function LectureInputPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const [lectureTopic, setLectureTopic] = useState("");
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const isLight = theme === "light";

    const handleProceed = async (e) => {
        e.preventDefault();
        if (!lectureTopic.trim() && files.length === 0) {
            return;
        }

        setIsUploading(true);
        
        try {
            const formData = new FormData();
            if (lectureTopic.trim()) {
                formData.append('topic', lectureTopic.trim());
            }
            
            files.forEach(file => {
                formData.append('files', file);
            });

            if (lectureTopic.trim()) {
                router.push(`/study-session?topic=${encodeURIComponent(lectureTopic.trim())}`);
            } else {
                router.push('/study-session');
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (selectedFiles) => {
        const validFiles = Array.from(selectedFiles).filter(file => {
            const validTypes = [
                'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
                'application/pdf', 
                'application/vnd.ms-powerpoint', 
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'image/png', 'image/jpeg', 'image/gif'
            ];
            const maxSize = 50 * 1024 * 1024; 
            
            if (!validTypes.includes(file.type)) {
                alert(`Unsupported file type: ${file.type}`);
                return false;
            }
            
            if (file.size > maxSize) {
                alert(`File too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
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
            {/* Header at the top - horizontal header only */}
            <Header />
            
            {/* Main content */}
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
                            Enter your lecture topic or upload audio/PDF/PPT files to start.
                        </p>
                    </div>

                    <form onSubmit={handleProceed} className="space-y-4">
                        {/* Topic Input */}
                        <div className="relative group">
                            <input
                                type="text"
                                value={lectureTopic}
                                onChange={(e) => setLectureTopic(e.target.value)}
                                placeholder="e.g., Introduction to Neural Networks"
                                className={`w-full px-4 py-3 md:py-3.5 rounded-xl text-sm md:text-base outline-none transition-all duration-300 border
                                    ${isLight
                                        ? "bg-white border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-900"
                                        : "bg-gray-800/50 border-gray-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-900/20 text-white placeholder-gray-500"
                                    }`}
                            />
                            {lectureTopic && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-blue-500 animate-in fade-in slide-in-from-right-2">
                                    <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
                                </div>
                            )}
                        </div>

                        {/* Divider with "OR" */}
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
                                accept=".mp3,.wav,.ogg,.mp4,.pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
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
                                    Supports audio, PDF, PowerPoint, and images
                                </p>
                            </div>
                        </div>

                        {/* File List */}
                        {files.length > 0 && (
                            <div className="space-y-2">
                                <h3 className={`font-medium text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    Files ({files.length})
                                </h3>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {files.map((file, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-between p-2 rounded-lg transition-all
                                                ${isLight
                                                    ? 'bg-white border border-gray-200'
                                                    : 'bg-gray-800/50 border border-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-md
                                                    ${isLight ? 'bg-gray-100' : 'bg-gray-800'}
                                                `}>
                                                    {getFileIcon(file.type)}
                                                </div>
                                                <div className="text-left">
                                                    <p className={`font-medium truncate max-w-[150px] text-sm
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
                                                className={`p-1 rounded-full hover:scale-110 transition-transform
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
                            type="submit"
                            disabled={(!lectureTopic.trim() && files.length === 0) || isUploading}
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
                    </form>

                    {/* Features */}
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLight ? "bg-green-500" : "bg-green-400"}`} />
                            AI Powered
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <Mic className="w-3 h-3" />
                            Audio Support
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <FileText className="w-3 h-3" />
                            PDF/PPT
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLight ? "bg-blue-500" : "bg-blue-400"}`} />
                            Real-time
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}