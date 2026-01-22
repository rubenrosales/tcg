
import React, { useState, useEffect } from 'react';
import { CardMetadata, CardGrading, TCGPlayerCondition } from '../types.ts';
import { generateListingCopy, analyzeCard } from '../services/geminiService.ts';
import { api } from '../services/apiService.ts';
import { 
  ChevronLeft, ExternalLink, Tag, Copy, Save, 
  Edit3, AlertTriangle, Search, CornerUpRight, 
  Layers, ScanEye, Hash, Loader2, X, Check, Gamepad2, Store, TrendingUp, Briefcase, Camera, RefreshCw, DollarSign, ShoppingCart, Sparkles
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CardDetailsProps {
  card: CardMetadata;
  onBack: () => void;
  onSave: (card: CardMetadata) => void;
  listingModel?: string;
  rubrics?: any;
  strictness?: any;
  analysisModel?: string;
  customPrompt?: string;
}

const CardDetails: React.FC<CardDetailsProps> = ({ card, onBack, onSave, listingModel, rubrics, strictness, analysisModel, customPrompt }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCard, setEditedCard] = useState<CardMetadata>({ ...card });
  const [hasChanges, setHasChanges] = useState(false);
  const [isGeneratingListing, setIsGeneratingListing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listingCopy, setListingCopy] = useState<{ ebay: string; tcg: string; title: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isRefreshingMarketData, setIsRefreshingMarketData] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [showRegradeModal, setShowRegradeModal] = useState(false);
  const [regradeFeedback, setRegradeFeedback] = useState('');

  // Reset active image when card changes
  useEffect(() => {
    setActiveImageIndex(0);
    setEditedCard({ ...card });
    setIsEditing(false);
    setHasChanges(false);
  }, [card.id]);

  const handleGradeChange = (field: keyof CardGrading, value: TCGPlayerCondition | string) => {
    setEditedCard(prev => ({
      ...prev,
      grading: { ...prev.grading, [field]: value }
    }));
    setHasChanges(true);
  };

  const getConditionColor = (condition: TCGPlayerCondition) => {
    switch (condition) {
      case 'NM': return 'text-green-600 bg-green-50 border-green-200';
      case 'LP': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'MP': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HP': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'DMG': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConditionValue = (value: any): TCGPlayerCondition => {
    // Handle TCGPlayer conditions
    if (typeof value === 'string' && ['NM', 'LP', 'MP', 'HP', 'DMG'].includes(value)) {
      return value as TCGPlayerCondition;
    }
    // Handle backward compatibility with numeric grades (convert to conditions)
    if (typeof value === 'number') {
      if (value >= 9) return 'NM';
      if (value >= 7.5) return 'LP';
      if (value >= 6) return 'MP';
      if (value >= 4) return 'HP';
      return 'DMG';
    }
    return 'NM'; // Default fallback
  };

  const conditionOptions: TCGPlayerCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedCard);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
      setHasChanges(false);
    }
  };

  const generateListings = async () => {
    setIsGeneratingListing(true);
    try {
      const copy = await generateListingCopy(editedCard, listingModel);
      setListingCopy(copy);
      // Save listing copy to card
      setEditedCard(prev => ({
        ...prev,
        listingInfo: {
          ...prev.listingInfo,
          listingCopy: copy
        }
      }));
      setHasChanges(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingListing(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const refreshMarketData = async () => {
    setIsRefreshingMarketData(true);
    try {
      const marketData = await api.fetchMarketData(editedCard, true);
      setEditedCard(prev => ({ ...prev, marketData }));
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to refresh market data:', error);
    } finally {
      setIsRefreshingMarketData(false);
    }
  };

  const handleRegrade = async () => {
    if (!editedCard.images || editedCard.images.length === 0) {
      alert('No images available for regrading');
      return;
    }

    setIsRegrading(true);
    try {
      // Convert images to base64
      const base64Images = await Promise.all(
        editedCard.images.map(async (img) => {
          if (img.startsWith('data:')) {
            return img.split(',')[1];
          }
          // If it's a URL, fetch and convert
          try {
            const response = await fetch(img);
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error('Failed to convert image:', e);
            return '';
          }
        })
      );

      const validImages = base64Images.filter(img => img.length > 0);
      if (validImages.length === 0) {
        throw new Error('No valid images found');
      }

      // Get current rubric
      const currentRubric = rubrics?.[editedCard.strictness || strictness || 'standard'];

      // Regrade with feedback
      const result = await analyzeCard(
        validImages,
        editedCard.strictness || strictness || 'standard',
        currentRubric,
        analysisModel,
        customPrompt,
        regradeFeedback || undefined
      );

      // Update card with new grading
      const updatedCard = {
        ...editedCard,
        grading: result.grading || editedCard.grading,
        suggestedPrice: result.suggestedPrice || editedCard.suggestedPrice,
        agents: result.agents || editedCard.agents
      };

      setEditedCard(updatedCard);
      setHasChanges(true);
      setShowRegradeModal(false);
      setRegradeFeedback('');
    } catch (error) {
      console.error('Regrade failed:', error);
      alert('Failed to regrade card. Please check your connection and try again.');
    } finally {
      setIsRegrading(false);
    }
  };

  const gradingCategories = [
    { label: 'Centering', scoreKey: 'centering', reasonKey: 'centeringReasoning', icon: Search, rubric: "NM=Perfect, LP=Minor off-center" },
    { label: 'Corners', scoreKey: 'corners', reasonKey: 'cornersReasoning', icon: CornerUpRight, rubric: "NM=Sharp, LP=Minor wear" },
    { label: 'Edges', scoreKey: 'edges', reasonKey: 'edgesReasoning', icon: Layers, rubric: "NM=Clean, LP=Minor whitening" },
    { label: 'Surface', scoreKey: 'surface', reasonKey: 'surfaceReasoning', icon: ScanEye, rubric: "NM=Flawless, LP=Minor scratches" },
  ] as const;

  return (
    <div className="max-w-7xl mx-auto animate-in slide-in-from-right duration-500 pb-24 md:pb-20 relative">
      {/* Regrade Modal */}
      {showRegradeModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => !isRegrading && setShowRegradeModal(false)}
        >
          <div 
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-6 border-b flex justify-between items-center bg-indigo-50">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Sparkles className="text-indigo-600" /> Regrade Card
              </h3>
              <button 
                onClick={() => setShowRegradeModal(false)} 
                disabled={isRegrading}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 md:p-8 overflow-y-auto space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-blue-900 text-sm mb-1">How Regrading Works</h4>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      The AI will re-analyze your card images using the same rubric settings. 
                      Optionally provide feedback about what the previous grading got wrong or missed, 
                      and the AI will pay special attention to those areas.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 block">
                  Optional Feedback
                  <span className="text-xs font-normal text-gray-500 ml-2">(What did the AI get wrong or miss?)</span>
                </label>
                <textarea
                  value={regradeFeedback}
                  onChange={(e) => setRegradeFeedback(e.target.value)}
                  placeholder="e.g., 'The AI missed a small crease on the top edge' or 'The corners are actually sharper than graded - no whitening visible' or 'The surface has print lines that weren't mentioned'"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none resize-none min-h-[120px]"
                  disabled={isRegrading}
                />
                <p className="text-xs text-gray-500">
                  Leave blank to regrade without feedback, or describe specific issues to help the AI improve.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowRegradeModal(false);
                    setRegradeFeedback('');
                  }}
                  disabled={isRegrading}
                  className="flex-1 px-4 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegrade}
                  disabled={isRegrading}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRegrading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Regrading...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Start Regrade
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listing Modal - Z-Index 100 to overlay everything */}
      {listingCopy && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setListingCopy(null)}
        >
          <div 
            className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 md:p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                <Tag className="text-indigo-600" /> AI-Generated Listings
              </h3>
              <button 
                onClick={() => setListingCopy(null)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 md:p-8 overflow-y-auto space-y-6 md:space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase">Optimized Title</label>
                <div className="flex gap-2">
                  <input readOnly value={listingCopy.title} className="flex-1 bg-gray-50 border rounded-xl px-4 py-3 font-medium text-sm md:text-base outline-none" />
                  <button onClick={() => copyToClipboard(listingCopy.title, 'title')} className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                    {copiedField === 'title' ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">eBay Description (Pro)</label>
                  <div className="relative h-48 md:h-64 bg-gray-50 border rounded-xl p-4 overflow-y-auto text-sm text-gray-600 leading-relaxed">
                    <pre className="whitespace-pre-wrap font-sans">{listingCopy.ebay}</pre>
                    <button onClick={() => copyToClipboard(listingCopy.ebay, 'ebay')} className="absolute top-2 right-2 p-2 bg-white shadow-md rounded-lg hover:bg-gray-50 transition-colors">
                      {copiedField === 'ebay' ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">TCGPlayer Condition Notes</label>
                  <div className="relative h-48 md:h-64 bg-gray-50 border rounded-xl p-4 overflow-y-auto text-sm text-gray-600 leading-relaxed">
                    <p>{listingCopy.tcg}</p>
                    <button onClick={() => copyToClipboard(listingCopy.tcg, 'tcg')} className="absolute top-2 right-2 p-2 bg-white shadow-md rounded-lg hover:bg-gray-50 transition-colors">
                      {copiedField === 'tcg' ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-medium transition-colors">
          <ChevronLeft size={20} /> Back to Inventory
        </button>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {isEditing ? (
            <>
              <button 
                onClick={() => { setIsEditing(false); setEditedCard({...card}); setHasChanges(false); }}
                className="flex-1 md:flex-none px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition-all"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-lg ${
                  hasChanges && !isSaving ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
              >
                <Edit3 size={18} /> Edit Grading
              </button>
              <button 
                onClick={() => setShowRegradeModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm"
              >
                <Sparkles size={18} /> Regrade
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-12 gap-6 md:gap-8">
        
        {/* Left Column: Image & Basic Info */}
        <div className="lg:col-span-1 xl:col-span-4 space-y-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 group relative">
            <div className="relative aspect-[3/4] mb-3 bg-gray-50 rounded-2xl overflow-hidden">
               {card.images && card.images.length > 0 ? (
                 <img src={card.images[activeImageIndex] || card.images[0]} alt={card.name} className="w-full h-full object-cover rounded-2xl shadow-xl border border-gray-100" />
               ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <Camera size={48} className="mb-2" />
                    <span className="text-xs font-bold">No Image</span>
                 </div>
               )}
               
               {!isEditing && (
                 <div className={`absolute top-4 right-4 ${getConditionColor((editedCard.grading.overallCondition || (editedCard.grading as any).overallGrade || 'NM') as TCGPlayerCondition)} w-16 h-16 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-2 border-white`}>
                  <span className="text-[8px] opacity-80 leading-none">CONDITION</span>
                  <span className="text-lg font-bold">{editedCard.grading.overallCondition || (editedCard.grading as any).overallGrade || 'NM'}</span>
                 </div>
               )}
               <div className="absolute top-4 left-4 flex flex-col gap-2">
                 <span className="px-3 py-1 bg-black/70 backdrop-blur-md text-white text-xs font-bold rounded-lg flex items-center gap-1 border border-white/20 w-fit">
                   <Gamepad2 size={12} /> {editedCard.game}
                 </span>
               </div>
            </div>
            
            {/* Image Thumbnails */}
            {card.images && card.images.length > 1 && (
               <div className="flex gap-2 overflow-x-auto pb-2">
                 {card.images.map((img, idx) => (
                   <button 
                     key={idx}
                     onClick={() => setActiveImageIndex(idx)}
                     className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                       activeImageIndex === idx ? 'border-indigo-600 shadow-md scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                     }`}
                   >
                     <img src={img} className="w-full h-full object-cover" alt={`Angle ${idx + 1}`} />
                   </button>
                 ))}
               </div>
            )}
          </div>
          
           {/* Rubric / Grading Section */}
          <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
              <span>Interactive Rubric</span>
              {isEditing && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">Editing Mode</span>}
            </h3>

            <div className="space-y-6">
              {gradingCategories.map((cat) => (
                <div key={cat.label} className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400">
                        <cat.icon size={16} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-700 block">{cat.label}</span>
                        {/* Rubric Hint */}
                        <span className="text-[10px] text-gray-400">{cat.rubric}</span>
                      </div>
                    </div>
                    <span className={`font-black text-lg px-3 py-1 rounded-lg border ${getConditionColor(getConditionValue(editedCard.grading[cat.scoreKey]))}`}>
                      {getConditionValue(editedCard.grading[cat.scoreKey])}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 transition-all">
                      <select
                        value={getConditionValue(editedCard.grading[cat.scoreKey])}
                        onChange={(e) => handleGradeChange(cat.scoreKey, e.target.value as TCGPlayerCondition)}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none font-semibold"
                        disabled={isSaving}
                      >
                        {conditionOptions.map(cond => (
                          <option key={cond} value={cond}>{cond} - {cond === 'NM' ? 'Near Mint' : cond === 'LP' ? 'Lightly Played' : cond === 'MP' ? 'Moderately Played' : cond === 'HP' ? 'Heavily Played' : 'Damaged'}</option>
                        ))}
                      </select>
                      <textarea
                        value={editedCard.grading[cat.reasonKey]}
                        onChange={(e) => handleGradeChange(cat.reasonKey, e.target.value)}
                        placeholder={`Override AI reasoning for ${cat.label}...`}
                        className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-700 focus:ring-2 focus:ring-indigo-100 resize-none outline-none"
                        rows={2}
                        disabled={isSaving}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[11px] text-gray-600 leading-relaxed pl-1 pt-1">
                         {editedCard.grading[cat.reasonKey] || 'No specific defects noted.'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Appraisal & Data */}
        <div className="lg:col-span-2 xl:col-span-8 space-y-6 md:space-y-8">
          
          {/* Main Info */}
          <div className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border border-gray-100">
             <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{editedCard.rarity}</span>
                <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mt-1">{editedCard.name}</h2>
                <div className="flex items-center gap-2 text-gray-500 flex-wrap mt-2">
                   <span className="font-medium text-base md:text-lg">{editedCard.set}</span>
                   <span className="text-gray-300">•</span>
                   <span className="font-medium text-base md:text-lg">#{editedCard.cardNumber}</span>
                   {editedCard.tags?.length > 0 && (
                      <div className="flex gap-1 ml-2 md:ml-4">
                        {editedCard.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-gray-200">
                            <Hash size={10} /> {tag}
                          </span>
                        ))}
                      </div>
                   )}
                </div>
                {/* Card Identifier Field */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Card Identifier</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCard.cardIdentifier || ''}
                      onChange={(e) => {
                        setEditedCard(prev => ({ ...prev, cardIdentifier: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="e.g., set number for Yu-Gi-Oh"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${editedCard.cardIdentifier ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                        {editedCard.cardIdentifier || 'No identifier set'}
                      </span>
                      {editedCard.cardIdentifier && (
                        <a
                          href={`https://www.tcgplayer.com/search/product/product?q=${encodeURIComponent(editedCard.cardIdentifier)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">Unique identifier for looking up this card (set number for Yu-Gi-Oh)</p>
                </div>
              </div>
              <button 
                  onClick={generateListings}
                  disabled={isGeneratingListing || isSaving}
                  className="w-full md:w-auto bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg group disabled:opacity-50"
                >
                  {isGeneratingListing ? <Loader2 className="animate-spin" size={20} /> : <Tag size={20} className="group-hover:rotate-12 transition-transform" />} 
                  {isGeneratingListing ? 'Writing...' : 'Generate Listings'}
              </button>
            </div>

            {/* Multi-Agent Appraisal Panel */}
            <div className="mb-10">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-700">
                 AI Appraisal Board
                 <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">3 Agents</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Agent 1: Conservative */}
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-300 transition-all">
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Store size={64} />
                   </div>
                   <div className="flex items-center gap-2 mb-3">
                      <div className="bg-white p-2 rounded-full shadow-sm text-slate-600">
                         <Store size={18} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{editedCard.agents?.conservative?.name || "The Shopkeeper"}</p>
                         <p className="text-[10px] text-slate-400">{editedCard.agents?.conservative?.persona || "Conservative"}</p>
                      </div>
                   </div>
                   <p className="text-2xl font-black text-slate-700 mb-2">${editedCard.agents?.conservative?.price || editedCard.suggestedPrice.low}</p>
                   <p className="text-xs text-slate-600 leading-relaxed italic">"{editedCard.agents?.conservative?.reasoning || "Based on quick-sale buy lists."}"</p>
                </div>

                {/* Agent 2: Market (Highlight) */}
                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl relative overflow-hidden ring-2 ring-indigo-500 ring-offset-2 hover:shadow-lg transition-all">
                   <div className="absolute top-0 right-0 p-3 opacity-10">
                      <Briefcase size={64} />
                   </div>
                   <div className="flex items-center gap-2 mb-3">
                      <div className="bg-indigo-600 p-2 rounded-full shadow-md text-white">
                         <Briefcase size={18} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider">{editedCard.agents?.market?.name || "The Collector"}</p>
                         <p className="text-[10px] text-indigo-600">{editedCard.agents?.market?.persona || "Market Average"}</p>
                      </div>
                   </div>
                   <p className="text-3xl font-black text-indigo-900 mb-2">${editedCard.agents?.market?.price || editedCard.suggestedPrice.mid}</p>
                   <p className="text-xs text-indigo-800 leading-relaxed italic">"{editedCard.agents?.market?.reasoning || "Fair market value based on recent comps."}"</p>
                </div>

                {/* Agent 3: Speculative */}
                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-300 transition-all">
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <TrendingUp size={64} />
                   </div>
                   <div className="flex items-center gap-2 mb-3">
                      <div className="bg-white p-2 rounded-full shadow-sm text-emerald-600">
                         <TrendingUp size={18} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{editedCard.agents?.speculative?.name || "The Investor"}</p>
                         <p className="text-[10px] text-emerald-500">{editedCard.agents?.speculative?.persona || "High Upside"}</p>
                      </div>
                   </div>
                   <p className="text-2xl font-black text-emerald-700 mb-2">${editedCard.agents?.speculative?.price || editedCard.suggestedPrice.high}</p>
                   <p className="text-xs text-emerald-700 leading-relaxed italic">"{editedCard.agents?.speculative?.reasoning || "Potential price if graded perfectly."}"</p>
                </div>

              </div>
            </div>

            {/* Market Data Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-700">Market Data</h3>
                <button
                  onClick={refreshMarketData}
                  disabled={isRefreshingMarketData}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isRefreshingMarketData ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* TCGPlayer Data */}
                {editedCard.marketData?.tcgplayer && (
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={20} className="text-orange-600" />
                        <h4 className="font-bold text-orange-900">TCGPlayer</h4>
                      </div>
                      {editedCard.marketData.tcgplayer.url && (
                        <a
                          href={editedCard.marketData.tcgplayer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    {editedCard.marketData.tcgplayer.prices && (
                      <div className="space-y-2">
                        {editedCard.marketData.tcgplayer.prices.market && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-700">Market Price:</span>
                            <span className="font-bold text-orange-900">${editedCard.marketData.tcgplayer.prices.market.toFixed(2)}</span>
                          </div>
                        )}
                        {editedCard.marketData.tcgplayer.prices.low && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-700">Low:</span>
                            <span className="font-semibold text-orange-800">${editedCard.marketData.tcgplayer.prices.low.toFixed(2)}</span>
                          </div>
                        )}
                        {editedCard.marketData.tcgplayer.prices.mid && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-700">Mid:</span>
                            <span className="font-semibold text-orange-800">${editedCard.marketData.tcgplayer.prices.mid.toFixed(2)}</span>
                          </div>
                        )}
                        {editedCard.marketData.tcgplayer.prices.high && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-700">High:</span>
                            <span className="font-semibold text-orange-800">${editedCard.marketData.tcgplayer.prices.high.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {editedCard.marketData.tcgplayer.lastUpdated && (
                      <p className="text-[10px] text-orange-600 mt-3">
                        Updated: {new Date(editedCard.marketData.tcgplayer.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* External Links */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                  <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <ExternalLink size={18} />
                    Quick Links
                  </h4>
                  <div className="space-y-2">
                    {editedCard.marketData?.tcgplayer?.url && (
                      <a
                        href={editedCard.marketData.tcgplayer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-white hover:bg-orange-50 rounded-lg transition-colors border border-gray-100 group"
                      >
                        <span className="text-sm font-medium text-gray-700 group-hover:text-orange-700">TCGPlayer</span>
                        <ExternalLink size={14} className="text-gray-400 group-hover:text-orange-500" />
                      </a>
                    )}
                    {editedCard.marketData?.ebay?.url && (
                      <a
                        href={editedCard.marketData.ebay.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-white hover:bg-blue-50 rounded-lg transition-colors border border-gray-100 group"
                      >
                        <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">eBay Search</span>
                        <ExternalLink size={14} className="text-gray-400 group-hover:text-blue-500" />
                      </a>
                    )}
                    {editedCard.marketData?.cardmarket?.url && (
                      <a
                        href={editedCard.marketData.cardmarket.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-white hover:bg-green-50 rounded-lg transition-colors border border-gray-100 group"
                      >
                        <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">Cardmarket</span>
                        <ExternalLink size={14} className="text-gray-400 group-hover:text-green-500" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {!editedCard.marketData && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                  <p className="text-sm text-yellow-800">
                    Market data not available. Click "Refresh" to fetch current prices and links.
                  </p>
                </div>
              )}
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-bold mb-4 text-gray-700">Price History (30 Days)</h3>
              <div className="h-64 bg-gray-50 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={editedCard.historicalData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} prefix="$" />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4 text-gray-700">Verified Sources</h3>
              <div className="space-y-3">
                {editedCard.groundingSources.length > 0 ? (
                  editedCard.groundingSources.map((source, idx) => (
                    <a 
                      key={idx} 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-colors group border border-gray-100"
                    >
                      <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700 truncate">{source.title}</span>
                      <ExternalLink size={16} className="text-gray-400 group-hover:text-indigo-500" />
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No direct sources found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardDetails;
