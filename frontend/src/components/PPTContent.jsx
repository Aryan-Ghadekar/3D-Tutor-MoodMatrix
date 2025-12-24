"use client";

import {
    Zap,
    Code2,
    Image as ImageIcon,
    BarChart3,
    Share2,
    Maximize2,
    Copy,
    Terminal,
    FileText
} from "lucide-react";
import { DraggableWrapper } from "./DraggableWrapper";
import { LaTeXRenderer, PhysicsChart, Physics3D } from "./PhysicsComponents";

export function TextContent({ title, bulletPoints, formulas = [] }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h1 className="text-4xl font-black text-slate-800 dark:text-white flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                    <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg">
                        <FileText className="w-8 h-8" />
                    </div>
                    {title}
                </h1>
            </DraggableWrapper>

            <DraggableWrapper defaultPosition={{ x: 60, y: 160 }} className="group">
                <div className="space-y-4 max-w-xl">
                    {bulletPoints.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <div className="w-2 h-2 mt-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                            <p className="text-lg text-slate-700 dark:text-slate-300 font-medium">{point}</p>
                        </div>
                    ))}
                </div>
            </DraggableWrapper>

            {formulas.length > 0 && (
                <DraggableWrapper defaultPosition={{ x: 450, y: 350 }} className="group">
                    <div className="p-6 rounded-3xl bg-indigo-500 text-white shadow-2xl border-4 border-white dark:border-slate-700">
                        {formulas.map((f, i) => (
                            <LaTeXRenderer key={i} formula={f} />
                        ))}
                    </div>
                </DraggableWrapper>
            )}
        </div>
    );
}

export function CodeContent({ title, code, language, explanation }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <Terminal className="w-8 h-8 text-blue-500" />
                    {title}
                </h2>
            </DraggableWrapper>

            <DraggableWrapper defaultPosition={{ x: 40, y: 140 }} className="group">
                <div className="relative group w-[800px]">
                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white backdrop-blur-md">
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
                        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d2d] border-b border-slate-700">
                            <div className="flex gap-2">
                                {["#ff5f57", "#ffbd2e", "#28c940"].map(c => (
                                    <div key={c} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">{language}</span>
                        </div>
                        <pre className="p-6 text-sm font-mono text-blue-300 overflow-x-auto">
                            <code>{code}</code>
                        </pre>
                    </div>
                </div>
            </DraggableWrapper>

            {explanation && (
                <DraggableWrapper defaultPosition={{ x: 50, y: 480 }} className="group">
                    <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 max-w-2xl">
                        <p className="text-sm font-medium">{explanation}</p>
                    </div>
                </DraggableWrapper>
            )}
        </div>
    );
}

export function ImageContent({ title, imageUrl, caption, chartData }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <ImageIcon className="w-8 h-8 text-indigo-500" />
                    {title}
                </h2>
            </DraggableWrapper>

            <DraggableWrapper defaultPosition={{ x: 60, y: 140 }} className="group">
                <div className="relative group p-2 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700 rotate-[-1deg] transition-transform hover:rotate-0">
                    <div className="relative w-[450px] h-[300px] rounded-[1.5rem] overflow-hidden">
                        <img src={imageUrl || "/placeholder.jpg"} alt={title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                            <p className="text-white text-sm font-medium">{caption}</p>
                        </div>
                    </div>
                </div>
            </DraggableWrapper>

            {chartData && (
                <DraggableWrapper defaultPosition={{ x: 550, y: 200 }} className="group">
                    <PhysicsChart data={chartData} title="Experimental Data Visualization" />
                </DraggableWrapper>
            )}
        </div>
    );
}

export function ChartContent({ title, chartType, data, physics3D = true }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-green-500" />
                    {title}
                </h2>
            </DraggableWrapper>

            <DraggableWrapper defaultPosition={{ x: 40, y: 150 }} className="group">
                <PhysicsChart data={data} title={chartType} />
            </DraggableWrapper>

            {physics3D && (
                <DraggableWrapper defaultPosition={{ x: 500, y: 150 }} className="group">
                    <Physics3D />
                </DraggableWrapper>
            )}
        </div>
    );
}

export function GraphContent({ title, nodes = [], edges = [], formulas = [] }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <Share2 className="w-8 h-8 text-purple-500" />
                    {title}
                </h2>
            </DraggableWrapper>

            <DraggableWrapper defaultPosition={{ x: 100, y: 150 }} className="group">
                <div className="relative w-[500px] h-[300px] border-2 border-dashed border-purple-200 dark:border-purple-800 rounded-3xl p-8 bg-white/30 dark:bg-purple-900/10 flex flex-wrap gap-6 items-center justify-center">
                    {nodes.map((node, i) => (
                        <div key={i} className="px-6 py-3 rounded-full bg-purple-500 text-white font-bold shadow-lg shadow-purple-200 dark:shadow-none hover:scale-110 transition-transform cursor-pointer">
                            {node.label}
                        </div>
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <Share2 className="w-64 h-64 text-purple-300" />
                    </div>
                </div>
            </DraggableWrapper>

            {formulas.map((f, i) => (
                <DraggableWrapper key={i} defaultPosition={{ x: 650, y: 100 + i * 120 }} className="group">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                        <LaTeXRenderer formula={f} />
                    </div>
                </DraggableWrapper>
            ))}
        </div>
    );
}

export function MixedContent({ title, items = [] }) {
    return (
        <div className="relative w-full h-[600px] bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 p-8">
            <DraggableWrapper defaultPosition={{ x: 40, y: 40 }} className="group">
                <h1 className="text-4xl font-black text-slate-800 dark:text-white flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20">
                    <div className="p-3 rounded-xl bg-blue-600 text-white shadow-lg">
                        <Zap className="w-8 h-8" />
                    </div>
                    {title}
                </h1>
            </DraggableWrapper>

            {items.map((item, index) => {
                // Generate random positions if not provided, avoiding the title area
                const defaultX = item.position?.x || (index % 2 === 0 ? 50 : 500);
                const defaultY = item.position?.y || (160 + Math.floor(index / 2) * 200);

                return (
                    <DraggableWrapper key={index} defaultPosition={{ x: defaultX, y: defaultY }} className="group">
                        <div className="relative">
                            {item.type === 'text' && (
                                <div className="space-y-4 max-w-md p-6 rounded-2xl bg-white/80 dark:bg-slate-800/80 shadow-sm border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{item.title}</h3>
                                    <ul className="space-y-2">
                                        {item.bulletPoints?.map((point, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                <span className="text-slate-700 dark:text-slate-300">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {item.type === 'code' && (
                                <div className="w-[500px] bg-[#1e1e1e] rounded-xl overflow-hidden shadow-xl border border-slate-700">
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-slate-700">
                                        <span className="text-xs font-mono text-slate-400 uppercase">{item.language}</span>
                                    </div>
                                    <pre className="p-4 text-sm font-mono text-blue-300 overflow-x-auto">
                                        <code>{item.code}</code>
                                    </pre>
                                </div>
                            )}

                            {item.type === 'image' && (
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                                    <div className="relative w-[300px] h-[200px] rounded-xl overflow-hidden">
                                        <img
                                            src={item.imageUrl || `https://via.placeholder.com/400x300?text=${encodeURIComponent(item.keywords?.[0] || 'Image')}`}
                                            alt={item.caption}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-2 text-white text-xs">
                                            {item.caption}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {item.type === 'chart' && (
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
                                    <PhysicsChart data={item.data} title={item.title} width={400} height={250} />
                                </div>
                            )}

                            {item.type === 'formula' && (
                                <div className="p-4 bg-indigo-600 text-white rounded-xl shadow-lg border-2 border-white/20">
                                    <LaTeXRenderer formula={item.latex} />
                                </div>
                            )}
                        </div>
                    </DraggableWrapper>
                );
            })}
        </div>
    );
}
