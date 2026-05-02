
import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';

interface SnailProgressProps {
  progress: number;
  label?: string;
}

const SnailProgress: React.FC<SnailProgressProps> = ({ progress, label }) => {
  const themeColor = useStore(state => state.getThemeColor());
  const colorMap: Record<string, string> = {
    blue: '#2563eb',
    emerald: '#059669',
    orange: '#ea580c',
    indigo: '#4f46e5',
    rose: '#e11d48',
    pink: '#db2777',
    purple: '#9333ea',
    yellow: '#d97706'
  };

  const color = colorMap[themeColor] || colorMap.blue;

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-end px-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label || 'Processing...'}</span>
        <span className="text-xl font-black text-slate-800">{Math.round(progress)}%</span>
      </div>
      
      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
        {/* The Track */}
        <motion.div 
          className="absolute top-0 left-0 h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        />
        
        {/* The Snail (Stylized) */}
        <motion.div 
          className="absolute top-1/2 -translate-y-1/2 z-10"
          initial={{ left: 0 }}
          animate={{ left: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          style={{ marginLeft: '-12px' }}
        >
          <div className="relative">
            {/* Snail Shell */}
            <div 
              className="w-8 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <div className="w-4 h-4 rounded-full border border-white/30" />
            </div>
            {/* Snail Head */}
            <div 
              className="absolute -right-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              <div className="absolute -top-1 -right-1 flex gap-1">
                <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
                <div className="w-0.5 h-2 bg-slate-800 rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Decorative dots */}
      <div className="flex justify-between px-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={i} 
            className={`w-1 h-1 rounded-full transition-colors duration-500 ${progress > (i * 10) ? 'bg-slate-400' : 'bg-slate-200'}`} 
          />
        ))}
      </div>
    </div>
  );
};

export default SnailProgress;
