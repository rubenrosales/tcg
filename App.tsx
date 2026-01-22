
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import Scanner from './components/Scanner.tsx';
import CardDetails from './components/CardDetails.tsx';
import Settings from './components/Settings.tsx';
import ListingsManager from './components/ListingsManager.tsx';
import { CardMetadata, ViewMode, StrictnessLevel, RubricDefinition, ModelPreferences } from './types.ts';
import { api } from './services/apiService.ts';
import { Search, Bell, User, LayoutDashboard, ScanLine, Box, Settings as SettingsIcon, Loader2 } from 'lucide-react';

const DEFAULT_RUBRICS: RubricDefinition = {
  relaxed: {
    centering: "Flexible. Visible leans are acceptable for a 10.",
    corners: "Minor white spots allowed on back corners.",
    edges: "Minor factory silvering or rough cuts ignored.",
    surface: "Faint print lines or surface dimples allowed."
  },
  standard: {
    centering: "Approx 60/40 front, 75/25 back for a 10.",
    corners: "Sharp corners. Microscopic whitening allowed on 1 corner.",
    edges: "Clean edges. No visible silvering or chipping.",
    surface: "Clean surface. No visible scratches or dimples."
  },
  strict: {
    centering: "Absolute 50/50 front and back. Zero tolerance.",
    corners: "Gem mint. Sharp under 10x magnification.",
    edges: "Razor clean. No factory defects allowed.",
    surface: "Zero imperfections. No print lines or surface wax."
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [inventory, setInventory] = useState<CardMetadata[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardMetadata | null>(null);
  const [defaultStrictness, setDefaultStrictness] = useState<StrictnessLevel>('standard');
  const [rubrics, setRubrics] = useState<RubricDefinition>(DEFAULT_RUBRICS);
  const [modelPreferences, setModelPreferences] = useState<ModelPreferences>({
    analysisModel: 'gemini-2.0-flash-exp',
    listingModel: 'gemini-2.0-flash-exp'
  });
  const [isAppLoading, setIsAppLoading] = useState(true);
  
  // Load initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const savedRubrics = localStorage.getItem('poke_rubrics');
        if (savedRubrics) setRubrics(JSON.parse(savedRubrics));
        
        const savedModels = localStorage.getItem('poke_model_preferences');
        if (savedModels) setModelPreferences(JSON.parse(savedModels));
        
        const cards = await api.getCards();
        setInventory(cards);
      } catch (e) {
        console.error("Failed to load inventory", e);
      } finally {
        setIsAppLoading(false);
      }
    };
    fetchData();
  }, []);

  // Save rubrics to localStorage
  useEffect(() => {
    localStorage.setItem('poke_rubrics', JSON.stringify(rubrics));
  }, [rubrics]);

  // Save model preferences to localStorage
  useEffect(() => {
    localStorage.setItem('poke_model_preferences', JSON.stringify(modelPreferences));
  }, [modelPreferences]);

  const handleCardAnalyzed = async (card: CardMetadata) => {
    // 1. Upload images first
    const uploadedImages = await Promise.all(
      card.images.map(img => api.uploadImage(img))
    );
    
    // 2. Create updated card object with server URLs
    const finalCard = { ...card, images: uploadedImages };
    
    // 3. Save to DB
    try {
      await api.saveCard(finalCard);
      setInventory(prev => [...prev, finalCard]);
      setSelectedCard(finalCard);
      setView(ViewMode.DETAILS);
    } catch (e) {
      alert("Failed to save card to database. Check console.");
      console.error(e);
    }
  };

  const handleUpdateCard = async (updatedCard: CardMetadata) => {
    try {
      await api.updateCard(updatedCard);
      setInventory(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
    } catch (e) {
      console.error("Failed to update card", e);
    }
  };

  const handleUpdateCards = async (updatedCards: CardMetadata[]) => {
    try {
      for (const card of updatedCards) {
        await api.updateCard(card);
      }
      setInventory(prev => {
        const updatedMap = new Map(updatedCards.map(c => [c.id, c]));
        return prev.map(c => updatedMap.get(c.id) || c);
      });
    } catch (e) {
      console.error("Failed to update cards", e);
    }
  };

  const handleLogout = () => confirm("Log out?") && alert("Signed out.");

  const renderContent = () => {
    if (isAppLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
          <p className="font-medium">Connecting to local server...</p>
        </div>
      );
    }

    switch (view) {
      case ViewMode.DASHBOARD: return <Dashboard inventory={inventory} />;
      case ViewMode.SCANNER: return <Scanner onCardAnalyzed={handleCardAnalyzed} defaultStrictness={defaultStrictness} rubrics={rubrics} analysisModel={modelPreferences.analysisModel} customPrompt={modelPreferences.customPrompt} />;
      case ViewMode.SETTINGS: return <Settings defaultStrictness={defaultStrictness} setDefaultStrictness={setDefaultStrictness} rubrics={rubrics} setRubrics={setRubrics} modelPreferences={modelPreferences} setModelPreferences={setModelPreferences} onLogout={handleLogout} />;
      case ViewMode.INVENTORY: return (
        <div className="space-y-6 pb-24 min-h-[calc(100vh-140px)]">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Inventory</h1><p className="text-gray-500">{inventory.length} cards tracked</p></div>
            <button onClick={() => setView(ViewMode.SCANNER)} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all">+ Add Card</button>
          </header>
          {inventory.length === 0 ? <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200"><p className="text-gray-400">Your inventory is empty. Start scanning!</p></div> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {inventory.map(card => (
                <div key={card.id} onClick={() => { setSelectedCard(card); setView(ViewMode.DETAILS); }} className="bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-3 bg-gray-50 relative">
                    <img src={card.images[0]} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-lg text-[10px] font-black text-indigo-700 shadow-sm">{card.grading.overallCondition || (card.grading as any).overallGrade || 'NM'}</div>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{card.name}</h3>
                  <div className="flex justify-between items-center mt-2"><span className="text-indigo-600 font-bold">${card.suggestedPrice.mid}</span><span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase">{card.status}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
      case ViewMode.LISTINGS: return <ListingsManager inventory={inventory} onUpdateCard={handleUpdateCard} onUpdateCards={handleUpdateCards} listingModel={modelPreferences.listingModel} />;
      case ViewMode.DETAILS: return selectedCard ? (
        <CardDetails 
          card={selectedCard} 
          onBack={() => setView(ViewMode.INVENTORY)} 
          onSave={handleUpdateCard} 
          listingModel={modelPreferences.listingModel}
          rubrics={rubrics}
          strictness={defaultStrictness}
          analysisModel={modelPreferences.analysisModel}
          customPrompt={modelPreferences.customPrompt}
        />
      ) : null;
      default: return <Dashboard inventory={inventory} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <Sidebar currentView={view} setView={setView} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto max-h-screen relative w-full pb-20 md:pb-0">
        <header className="hidden md:flex h-20 bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 px-8 items-center justify-between">
          <div className="relative w-96"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input placeholder="Search collection..." className="w-full bg-gray-100 border-none rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-100 transition-all outline-none" /></div>
          <div className="flex items-center gap-4"><button className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-all relative"><Bell size={20} /></button><div className="h-8 w-[1px] bg-gray-200 mx-2" /><button className="flex items-center gap-3 pl-2 pr-4 py-1.5 hover:bg-gray-100 rounded-xl transition-all"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><User size={18} /></div><span className="text-sm font-semibold text-gray-700">Ash K.</span></button></div>
        </header>
        <div className="p-4 md:p-8">{renderContent()}</div>
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 shadow-lg pb-safe">
           <button onClick={() => setView(ViewMode.DASHBOARD)} className={`flex flex-col items-center gap-1 ${view === ViewMode.DASHBOARD ? 'text-indigo-600' : 'text-gray-400'}`}><LayoutDashboard size={24} /><span className="text-[10px]">Home</span></button>
           <button onClick={() => setView(ViewMode.SCANNER)} className={`flex flex-col items-center gap-1 ${view === ViewMode.SCANNER ? 'text-indigo-600' : 'text-gray-400'}`}><div className={`${view === ViewMode.SCANNER ? 'bg-indigo-700' : 'bg-indigo-600'} text-white p-3 rounded-full -mt-8 shadow-lg border-4 border-white transition-all`}><ScanLine size={24} /></div><span className="text-[10px]">Scan</span></button>
           <button onClick={() => setView(ViewMode.INVENTORY)} className={`flex flex-col items-center gap-1 ${view === ViewMode.INVENTORY ? 'text-indigo-600' : 'text-gray-400'}`}><Box size={24} /><span className="text-[10px]">Cards</span></button>
           <button onClick={() => setView(ViewMode.SETTINGS)} className={`flex flex-col items-center gap-1 ${view === ViewMode.SETTINGS ? 'text-indigo-600' : 'text-gray-400'}`}><SettingsIcon size={24} /><span className="text-[10px]">Settings</span></button>
        </div>
      </main>
    </div>
  );
};

export default App;
