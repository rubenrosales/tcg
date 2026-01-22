
import React, { useState, useEffect } from 'react';
import { StrictnessLevel, RubricDefinition, RubricRules, ModelPreferences } from '../types';
import { api } from '../services/apiService';
import { AVAILABLE_ANALYSIS_MODELS, AVAILABLE_LISTING_MODELS, DEFAULT_ANALYSIS_PROMPT } from '../services/geminiService';
import { Save, Bell, Shield, Database, LogOut, ChevronRight, Monitor, Moon, BookOpen, Info, ExternalLink, Library, X, Network, Smartphone, Wifi, CheckCircle, AlertCircle, Loader2, Cpu } from 'lucide-react';

interface SettingsProps {
  defaultStrictness: StrictnessLevel;
  setDefaultStrictness: (level: StrictnessLevel) => void;
  rubrics: RubricDefinition;
  setRubrics: (rubrics: RubricDefinition) => void;
  modelPreferences: ModelPreferences;
  setModelPreferences: (prefs: ModelPreferences) => void;
  onLogout: () => void;
}

type SettingsTab = 'standards' | 'application' | 'data' | 'library' | 'server';

const OFFICIAL_SOURCES = [
  {
    name: "PSA (Professional Sports Authenticator)",
    description: "The industry standard for sports and TCG. Known for their 1-10 scale and 'Set Registry'. Highly values eye appeal.",
    url: "https://www.psacard.com/gradingstandards",
    color: "border-red-500",
    tags: ["Market Leader", "1-10 Scale"]
  },
  {
    name: "Beckett (BGS)",
    description: "Famous for 'Subgrades' (Centering, Corners, Edges, Surface). A 'Black Label' 10 is considered the pinnacle of card quality.",
    url: "https://www.beckett.com/grading/grading-scale",
    color: "border-blue-800",
    tags: ["Subgrades", "Black Label"]
  },
  {
    name: "CGC Cards",
    description: "Specializes in pop culture and TCGs. Known for advanced imaging technology and consistent grading for Pokemon.",
    url: "https://www.cgccards.com/grading/grading-scale/",
    color: "border-teal-600",
    tags: ["Tech-Focused", "TCG Specialist"]
  },
  {
    name: "TCGPlayer Standards",
    description: "The gold standard for raw (ungraded) card sales. Defines Near Mint (NM), Lightly Played (LP), etc.",
    url: "https://help.tcgplayer.com/hc/en-us/articles/221430307-How-can-I-tell-what-condition-a-card-is-in-",
    color: "border-orange-500",
    tags: ["Raw Cards", "Marketplace Standard"]
  }
];

const Settings: React.FC<SettingsProps> = ({ defaultStrictness, setDefaultStrictness, rubrics, setRubrics, modelPreferences, setModelPreferences, onLogout }) => {
  const [activeTab, setActiveTab] = useState<StrictnessLevel>(defaultStrictness);
  const [navTab, setNavTab] = useState<SettingsTab>('standards');
  const [serverIp, setServerIp] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiKeys, setApiKeys] = useState<{ publicKey: string; privateKey: string }>(() => {
    const saved = localStorage.getItem('tcgplayer_api_keys');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { publicKey: '', privateKey: '' };
      }
    }
    return { publicKey: '', privateKey: '' };
  });

  useEffect(() => {
    const saved = localStorage.getItem('pokesell_server_ip');
    if (saved) setServerIp(saved);
  }, []);

  const handleRubricChange = (field: keyof RubricRules, value: string) => {
    setRubrics({
      ...rubrics,
      [activeTab]: {
        ...rubrics[activeTab],
        [field]: value
      }
    });
  };

  const cleanIp = (input: string) => {
    let clean = input.replace(/^https?:\/\//, '');
    clean = clean.replace(/\/$/, '');
    if (clean.includes(':')) {
      clean = clean.split(':')[0];
    }
    return clean;
  };

  const testConnection = async () => {
    // Temporarily save to local storage so apiService uses the new value
    const cleaned = cleanIp(serverIp);
    localStorage.setItem('pokesell_server_ip', cleaned);
    setServerIp(cleaned);
    
    setConnectionStatus('testing');
    const success = await api.ping();
    setConnectionStatus(success ? 'success' : 'error');
    
    if (success) {
      setTimeout(() => {
        alert('Connected successfully! The app will reload to sync data.');
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500 pb-32">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your grading logic and app preferences</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible">
            {[
              { id: 'standards', label: 'Grading Standards', icon: Shield },
              { id: 'models', label: 'AI Models', icon: Cpu },
              { id: 'api', label: 'API Keys', icon: Network },
              { id: 'library', label: 'Reference Library', icon: Library },
              { id: 'server', label: 'Server Config', icon: Wifi },
              { id: 'data', label: 'Data & Export', icon: Database },
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setNavTab(item.id as SettingsTab)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  navTab === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-gray-100 text-gray-500 font-bold rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {navTab === 'standards' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Rubric Architect</h2>
                    <p className="text-sm text-gray-500">Customize how the AI evaluates your cards</p>
                  </div>
                </div>
              </div>

              <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
                {(['relaxed', 'standard', 'strict'] as StrictnessLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setActiveTab(level)}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold capitalize transition-all ${
                      activeTab === level
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                {[
                  { label: 'Centering', key: 'centering', placeholder: 'e.g., NM requires 50/50 front, 60/40 back. Do not mistake design elements for centering issues.' },
                  { label: 'Corners', key: 'corners', placeholder: 'e.g., NM requires no whitening. Do not mistake holo effects or design patterns for corner damage.' },
                  { label: 'Edges', key: 'edges', placeholder: 'e.g., NM requires clean edges. Do not mistake foil patterns or special finishes for edge wear.' },
                  { label: 'Surface', key: 'surface', placeholder: 'e.g., NM requires no actual scratches or dents. Do not mistake holo patterns, textures, or special effects for surface damage.' },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{field.label}</label>
                      <div className="group relative">
                        <Info size={14} className="text-gray-300 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          This rule is sent directly to Gemini as a grading constraint for "{activeTab}" mode.
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={rubrics[activeTab][field.key as keyof RubricRules]}
                      onChange={(e) => handleRubricChange(field.key as keyof RubricRules, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-100 transition-all resize-none min-h-[80px] outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Custom Prompt Editor */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Custom Analysis Prompt</label>
                    <div className="group relative">
                      <Info size={14} className="text-gray-300 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Customize the prompt sent to the AI model. Use {'${rulesPrompt}'} to insert rubric rules. Leave empty to use default prompt.
                      </div>
                    </div>
                  </div>
                  {modelPreferences.customPrompt && (
                    <button
                      onClick={() => {
                        setModelPreferences({ ...modelPreferences, customPrompt: undefined });
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
                <textarea
                  value={modelPreferences.customPrompt || ''}
                  onChange={(e) => setModelPreferences({ ...modelPreferences, customPrompt: e.target.value || undefined })}
                  placeholder={DEFAULT_ANALYSIS_PROMPT.substring(0, 200) + '...'}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-mono text-gray-700 focus:ring-2 focus:ring-indigo-100 transition-all resize-none min-h-[300px] outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-2">
                  Tip: Use {'${rulesPrompt}'} in your custom prompt to automatically insert the rubric rules for the selected strictness level.
                </p>
              </div>
            </section>
          )}

          {navTab === 'api' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                  <Network size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">API Configuration</h2>
                  <p className="text-sm text-gray-500">Configure API keys for market data sources</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-yellow-900 text-sm mb-1">TCGPlayer API Access</h3>
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      TCGPlayer is currently not accepting new API applications. If you have existing API credentials, enter them below. 
                      The app will still work without API keys - it will provide search links instead of live pricing data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    TCGPlayer Public Key (Client ID)
                  </label>
                  <input
                    type="password"
                    value={apiKeys.publicKey}
                    onChange={(e) => {
                      const newKeys = { ...apiKeys, publicKey: e.target.value };
                      setApiKeys(newKeys);
                      localStorage.setItem('tcgplayer_api_keys', JSON.stringify(newKeys));
                    }}
                    placeholder="Enter your TCGPlayer Public Key"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    TCGPlayer Private Key (Client Secret)
                  </label>
                  <input
                    type="password"
                    value={apiKeys.privateKey}
                    onChange={(e) => {
                      const newKeys = { ...apiKeys, privateKey: e.target.value };
                      setApiKeys(newKeys);
                      localStorage.setItem('tcgplayer_api_keys', JSON.stringify(newKeys));
                    }}
                    placeholder="Enter your TCGPlayer Private Key"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      localStorage.removeItem('tcgplayer_api_keys');
                      setApiKeys({ publicKey: '', privateKey: '' });
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-semibold"
                  >
                    Clear API Keys
                  </button>
                </div>
              </div>
            </section>
          )}

          {navTab === 'models' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                  <Cpu size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Model Selection</h2>
                  <p className="text-sm text-gray-500">Choose which Gemini models to use (with automatic fallback)</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-yellow-900 text-sm mb-1">Automatic Fallback</h3>
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      If your selected model fails (404 = not found, 429 = quota exceeded), the system will automatically try the next available model in the fallback list. This ensures your analysis continues even if one model is unavailable or has hit its quota limit.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Card Analysis Model
                    <span className="text-xs font-normal text-gray-400 ml-2">(Primary model for card grading)</span>
                  </label>
                  <select
                    value={modelPreferences.analysisModel}
                    onChange={(e) => setModelPreferences({ ...modelPreferences, analysisModel: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                  >
                    {AVAILABLE_ANALYSIS_MODELS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Fallback order: {AVAILABLE_ANALYSIS_MODELS.filter(m => m !== modelPreferences.analysisModel).join(' → ')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Listing Copy Model
                    <span className="text-xs font-normal text-gray-400 ml-2">(Primary model for generating sales copy)</span>
                  </label>
                  <select
                    value={modelPreferences.listingModel}
                    onChange={(e) => setModelPreferences({ ...modelPreferences, listingModel: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                  >
                    {AVAILABLE_LISTING_MODELS.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Fallback order: {AVAILABLE_LISTING_MODELS.filter(m => m !== modelPreferences.listingModel).join(' → ')}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setModelPreferences({
                        analysisModel: 'gemini-2.0-flash-exp',
                        listingModel: 'gemini-2.0-flash-exp'
                      });
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
                  >
                    Reset to Recommended Defaults
                  </button>
                </div>
              </div>
            </section>
          )}

          {navTab === 'library' && (
            <section className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-indigo-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2">Reference Library</h2>
                  <p className="text-indigo-100 text-sm max-w-md">Official grading standards from the most trusted authorities in the industry.</p>
                </div>
                <Library size={120} className="absolute -right-4 -bottom-4 text-white/10 rotate-12" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {OFFICIAL_SOURCES.map((source) => (
                  <a 
                    key={source.name}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group bg-white p-6 rounded-3xl border-l-4 ${source.color} shadow-sm border-y border-r border-gray-100 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{source.name}</h3>
                        <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-400" />
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{source.description}</p>
                      <div className="flex gap-2">
                        {source.tags.map(tag => (
                          <span key={tag} className="text-[10px] bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase">{tag}</span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all hidden md:block" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {navTab === 'server' && (
            <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-indigo-100 p-2.5 rounded-2xl text-indigo-600">
                  <Network size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Connect to PC</h2>
                  <p className="text-sm text-gray-500">Configure remote access for your phone</p>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-indigo-200 rounded-lg text-indigo-700 hidden md:block">
                    <Wifi size={24} />
                  </div>
                  <div>
                     <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-wide mb-2">How to connect</h3>
                     <ol className="list-decimal list-inside space-y-2 text-sm text-indigo-800">
                        <li>Ensure both devices are on the <strong>same Wi-Fi network</strong>.</li>
                        <li>On your PC, look at the terminal where you ran <code>npm run dev</code>.</li>
                        <li>Find the IP address listed (e.g., <code>192.168.1.5</code>).</li>
                        <li>Enter that IP address below.</li>
                     </ol>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700">Desktop IP Address</label>
                <div className="flex gap-3">
                   <div className="relative flex-1">
                      <input 
                        type="text" 
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        placeholder="e.g. 192.168.1.5" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                         <span className="text-gray-400 text-xs font-bold">PORT: 3001</span>
                      </div>
                   </div>
                   <button 
                     onClick={testConnection}
                     disabled={connectionStatus === 'testing'}
                     className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                       connectionStatus === 'success' ? 'bg-green-600 text-white' :
                       connectionStatus === 'error' ? 'bg-red-600 text-white' :
                       'bg-gray-900 text-white hover:bg-gray-800'
                     }`}
                   >
                     {connectionStatus === 'testing' ? <Loader2 size={18} className="animate-spin" /> : 
                      connectionStatus === 'success' ? <CheckCircle size={18} /> : 
                      connectionStatus === 'error' ? <AlertCircle size={18} /> : 
                      <Save size={18} />}
                     {connectionStatus === 'testing' ? 'Testing...' : 
                      connectionStatus === 'success' ? 'Connected' : 
                      connectionStatus === 'error' ? 'Failed' : 
                      'Test & Save'}
                   </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                     Target: <strong>{serverIp ? `http://${cleanIp(serverIp)}:3001` : 'http://localhost:3001'}</strong>
                  </p>
                  {connectionStatus === 'error' && <span className="text-xs font-bold text-red-500">Connection Failed. Check IP or Firewall.</span>}
                </div>
              </div>
            </section>
          )}

          {navTab === 'data' && (
             <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center py-20">
                <Database size={48} className="text-gray-200 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">Data Management</h3>
                <p className="text-gray-500 max-w-xs mx-auto mt-2">Export functionality coming soon. Your data is currently stored in <code>db.json</code> on the server.</p>
             </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
