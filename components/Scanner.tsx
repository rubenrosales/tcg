
import React, { useState, useRef, useEffect } from 'react';
import { analyzeCard } from '../services/geminiService';
import { CardMetadata, StrictnessLevel, RubricDefinition } from '../types';
import { api } from '../services/apiService';
import { Camera, RefreshCw, Check, Loader2, Sparkles, Upload, AlertCircle, Gamepad2, Gauge, X, Plus } from 'lucide-react';

interface ScannerProps {
  onCardAnalyzed: (card: CardMetadata) => void;
  defaultStrictness: StrictnessLevel;
  rubrics: RubricDefinition;
  analysisModel?: string;
  customPrompt?: string;
}

const LOADING_STEPS = [
  "Detecting card details...",
  "Running high-res analysis...",
  "Applying custom rubrics...",
  "Gathering market data...",
  "Finalizing grade..."
];

const Scanner: React.FC<ScannerProps> = ({ onCardAnalyzed, defaultStrictness, rubrics, analysisModel, customPrompt }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [strictness, setStrictness] = useState<StrictnessLevel>(defaultStrictness);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: number;
    if (isAnalyzing) {
      interval = window.setInterval(() => {
        setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = event.target?.result as string;
          setCapturedImages(prev => [...prev, result]);
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (capturedImages.length === 0) return;
    
    setIsAnalyzing(true);
    try {
      // Extract base64 content
      const base64Images = capturedImages.map(img => img.split(',')[1]);
      
      const currentRubric = rubrics[strictness];
      const result = await analyzeCard(base64Images, strictness, currentRubric, analysisModel, customPrompt);
      
      const newCard: CardMetadata = {
        id: Math.random().toString(36).substring(2, 15),
        game: result.game || "Unknown TCG",
        name: result.name || "Unknown Card",
        set: result.set || "Unknown Set",
        cardNumber: result.cardNumber || "???",
        rarity: result.rarity || "Common",
        isHolo: result.isHolo || false,
        strictness: strictness,
        grading: result.grading || { 
          centering: 'NM', centeringReasoning: "",
          corners: 'NM', cornersReasoning: "", 
          edges: 'NM', edgesReasoning: "", 
          surface: 'NM', surfaceReasoning: "", 
          overallCondition: 'NM', overallNotes: "" 
        },
        images: capturedImages,
        status: 'inventory',
        tags: [],
        suggestedPrice: result.suggestedPrice || { low: 0, mid: 0, high: 0 },
        agents: result.agents || {
          conservative: { id: '1', name: 'Shopkeeper', persona: 'Conservative', price: 0, reasoning: '', confidence: 0 },
          market: { id: '2', name: 'Collector', persona: 'Market', price: 0, reasoning: '', confidence: 0 },
          speculative: { id: '3', name: 'Investor', persona: 'Speculative', price: 0, reasoning: '', confidence: 0 }
        },
        historicalData: result.historicalData || [],
        groundingSources: result.groundingSources || [],
        cardIdentifier: result.cardIdentifier || ''
      };
      
      // Fetch market data in the background (non-blocking)
      api.fetchMarketData(newCard).then(marketData => {
        newCard.marketData = marketData;
        // Update the card with market data
        api.updateCard(newCard).catch(err => console.error('Failed to update card with market data:', err));
      }).catch(err => {
        console.error('Failed to fetch market data:', err);
        // Continue even if market data fails
      });
      
      onCardAnalyzed(newCard);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze card. Check connection and image clarity.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500 pb-20">
      <header className="text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-100">
          <Camera size={32} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Scan New Card</h1>
        <p className="text-gray-500 mt-2">Upload front, back, and detail shots for accurate AI grading</p>
      </header>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 min-h-[400px] flex flex-col">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-100 animate-in slide-in-from-top">
            <AlertCircle size={20} />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        {isAnalyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
             <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-indigo-100 animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
             </div>
             <p className="text-2xl font-black mt-8 text-indigo-900 uppercase tracking-tight">AI Analysis in Progress</p>
             <p className="text-indigo-600 font-medium mt-2 bg-indigo-50 px-4 py-1 rounded-full">{LOADING_STEPS[loadingStep]}</p>
          </div>
        ) : (
          <div className="space-y-8 flex-1 flex flex-col">
            
            {/* Strictness Selector */}
            {capturedImages.length === 0 && (
              <div className="flex flex-col items-center">
                <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Grading Strictness</label>
                <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full max-w-md">
                  {(['relaxed', 'standard', 'strict'] as StrictnessLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setStrictness(level)}
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all ${
                        strictness === level 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State Dropzone */}
            {capturedImages.length === 0 && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-4 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group min-h-[300px]"
              >
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-white transition-colors shadow-sm">
                  <Upload className="text-gray-400 group-hover:text-indigo-600" size={32} />
                </div>
                <p className="text-xl font-bold text-gray-700">Drop images or click</p>
                <p className="text-sm text-gray-400 mt-2">Supports multiple files</p>
              </div>
            )}

            {/* Image Gallery Grid */}
            {capturedImages.length > 0 && (
              <div className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm border border-gray-100 group">
                      <img src={img} alt={`Scan ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {idx === 0 ? 'FRONT' : idx === 1 ? 'BACK' : 'DETAIL'}
                      </div>
                    </div>
                  ))}
                  
                  {/* Add More Button */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all gap-2"
                  >
                    <Plus size={24} />
                    <span className="text-xs font-bold uppercase">Add Photo</span>
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={startAnalysis}
                    className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles size={20} />
                    Analyze {capturedImages.length} Image{capturedImages.length > 1 ? 's' : ''}
                  </button>
                  <button 
                    onClick={() => setCapturedImages([])}
                    className="w-full py-3 text-gray-400 font-semibold hover:text-red-500 transition-colors text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple
              onChange={handleFileUpload}
              disabled={isAnalyzing}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
