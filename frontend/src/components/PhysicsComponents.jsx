"use client";
import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from "recharts";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sphere, MeshDistortMaterial } from "@react-three/drei";

export function LaTeXRenderer({ formula, inline = false }) {
    return (
        <div className="p-2 transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer">
            {inline ? <InlineMath math={formula} /> : <BlockMath math={formula} />}
        </div>
    );
}

export function PhysicsChart({ data, title }) {
    return (
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md shadow-xl w-80">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export function Physics3D() {
    return (
        <div className="w-60 h-60 rounded-full overflow-hidden border-2 border-blue-400 bg-blue-500/10 backdrop-blur-sm relative group cursor-pointer shadow-neon">
            <Canvas>
                <ambientLight intensity={1} />
                <pointLight position={[10, 10, 10]} />
                <Sphere args={[1, 100, 200]} scale={2.4}>
                    <MeshDistortMaterial
                        color="#3b82f6"
                        attach="material"
                        distort={0.4}
                        speed={2}
                    />
                </Sphere>
                <OrbitControls enableZoom={false} />
            </Canvas>
            <div className="absolute inset-x-0 bottom-4 text-center pointer-events-none">
                <span className="text-[10px] font-bold text-blue-300 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                    3D Interactive Model
                </span>
            </div>
        </div>
    );
}
