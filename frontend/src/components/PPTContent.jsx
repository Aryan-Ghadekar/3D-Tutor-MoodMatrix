"use client";

import { useTheme } from "../app/theme-provider";
import { Copy, Terminal, Image as ImageIcon, BarChart2, PieChart as PieChartIcon } from "lucide-react";

export const TextContent = ({ title, bulletPoints }) => {
    const { theme } = useTheme();
    const isLight = theme === "light";
    return (
        <div className="space-y-6">
            <h2 className={`text-3xl font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
            <ul className="space-y-4">
                {bulletPoints.map((point, i) => (
                    <li key={i} className={`flex items-start gap-3 text-lg ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                        <span className="mt-2 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        {point}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const CodeContent = ({ title, code, language }) => {
    const { theme } = useTheme();
    const isLight = theme === "light";
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className={`text-2xl font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-mono ${isLight ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"}`}>
                    <Terminal className="w-4 h-4" />
                    {language}
                </div>
            </div>
            <div className={`relative rounded-xl overflow-hidden border ${isLight ? "bg-gray-50 border-gray-200" : "bg-[#0d1117] border-gray-800"}`}>
                <pre className="p-6 overflow-x-auto">
                    <code className={`font-mono text-sm ${isLight ? "text-gray-800" : "text-gray-300"}`}>
                        {code}
                    </code>
                </pre>
                <button className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-700/20 transition-colors">
                    <Copy className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        </div>
    );
};

export const ImageContent = ({ title, imageUrl, caption }) => {
    const { theme } = useTheme();
    const isLight = theme === "light";
    return (
        <div className="space-y-4 h-full flex flex-col">
            <h2 className={`text-2xl font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
            <div className={`flex-1 relative rounded-2xl overflow-hidden border ${isLight ? "bg-white border-gray-200" : "bg-gray-900/50 border-gray-800"}`}>
                {imageUrl ? (
                    <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-500">
                        <ImageIcon className="w-12 h-12" />
                        <p className="animate-pulse">Fetching AI-generated visual...</p>
                    </div>
                )}
            </div>
            {caption && <p className={`text-center italic ${isLight ? "text-gray-500" : "text-gray-400"}`}>{caption}</p>}
        </div>
    );
};

export const ChartContent = ({ title, type, data }) => {
    const { theme } = useTheme();
    const isLight = theme === "light";
    return (
        <div className="space-y-4 h-full flex flex-col">
            <h2 className={`text-2xl font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
            <div className={`flex-1 rounded-2xl p-6 border flex items-center justify-center ${isLight ? "bg-white border-gray-200" : "bg-gray-900/50 border-gray-800"}`}>
                <div className="text-center space-y-4">
                    <BarChart2 className="w-16 h-16 text-blue-500 mx-auto" />
                    <p className={isLight ? "text-gray-600" : "text-gray-400"}>
                        Interactive {type} visualization of {title}
                    </p>
                    <div className="flex gap-2 justify-center">
                        {data.map((item, i) => (
                            <div key={i} className="w-8 bg-blue-500/50 rounded-t" style={{ height: `${item.value * 2}px` }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const GraphContent = ({ title, nodes, edges }) => {
    const { theme } = useTheme();
    const isLight = theme === "light";
    return (
        <div className="space-y-4 h-full flex flex-col">
            <h2 className={`text-2xl font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
            <div className={`flex-1 rounded-2xl p-6 border flex items-center justify-center ${isLight ? "bg-white border-gray-200" : "bg-gray-900/50 border-gray-800"}`}>
                <div className="relative w-full h-full flex items-center justify-center">
                    <PieChartIcon className="w-20 h-20 text-purple-500/30 absolute opacity-20" />
                    <div className="grid grid-cols-2 gap-4">
                        {nodes.map((node, i) => (
                            <div key={i} className={`p-3 rounded-xl border text-center text-sm ${isLight ? "bg-white border-blue-100 text-blue-700" : "bg-blue-500/10 border-blue-900/30 text-blue-300"}`}>
                                {node.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
