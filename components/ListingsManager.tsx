
import React, { useState, useMemo } from 'react';
import { CardMetadata } from '../types';
import { api } from '../services/apiService';
import { generateListingCopy } from '../services/geminiService';
import {
  CheckSquare, Square, Filter, Search, Download, Tag, CheckCircle, XCircle,
  Package, DollarSign, Calendar, ExternalLink, Copy, Check, Loader2, RefreshCw,
  FileText, ShoppingCart, AlertCircle
} from 'lucide-react';

interface ListingsManagerProps {
  inventory: CardMetadata[];
  onUpdateCard: (card: CardMetadata) => void;
  onUpdateCards: (cards: CardMetadata[]) => void;
  listingModel?: string;
}

type StatusFilter = 'all' | 'inventory' | 'listing' | 'sold';
type SortField = 'name' | 'price' | 'date' | 'status';

const ListingsManager: React.FC<ListingsManagerProps> = ({
  inventory,
  onUpdateCard,
  onUpdateCards,
  listingModel
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let filtered = [...inventory];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(card => card.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(card =>
        card.name.toLowerCase().includes(query) ||
        card.set.toLowerCase().includes(query) ||
        card.cardNumber.toLowerCase().includes(query) ||
        card.game.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'price':
          aVal = a.listingInfo?.listingPrice || a.suggestedPrice.mid;
          bVal = b.listingInfo?.listingPrice || b.suggestedPrice.mid;
          break;
        case 'date':
          aVal = a.listingInfo?.listedDate || a.listingInfo?.soldDate || '';
          bVal = b.listingInfo?.listedDate || b.listingInfo?.soldDate || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inventory, statusFilter, searchQuery, sortField, sortDirection]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCards.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)));
    }
  };

  const getSelectedCards = () => {
    return filteredCards.filter(card => selectedIds.has(card.id));
  };

  // Bulk actions
  const bulkMarkAsListed = async () => {
    const selected = getSelectedCards();
    const updated = selected.map(card => ({
      ...card,
      status: 'listing' as const,
      listingInfo: {
        ...card.listingInfo,
        listedDate: card.listingInfo?.listedDate || new Date().toISOString()
      }
    }));

    for (const card of updated) {
      await api.updateCard(card);
      onUpdateCard(card);
    }
    setSelectedIds(new Set());
  };

  const bulkMarkAsSold = async () => {
    const selected = getSelectedCards();
    const updated = selected.map(card => ({
      ...card,
      status: 'sold' as const,
      listingInfo: {
        ...card.listingInfo,
        soldDate: card.listingInfo?.soldDate || new Date().toISOString()
      }
    }));

    for (const card of updated) {
      await api.updateCard(card);
      onUpdateCard(card);
    }
    setSelectedIds(new Set());
  };

  const bulkMarkAsInventory = async () => {
    const selected = getSelectedCards();
    const updated = selected.map(card => ({
      ...card,
      status: 'inventory' as const
    }));

    for (const card of updated) {
      await api.updateCard(card);
      onUpdateCard(card);
    }
    setSelectedIds(new Set());
  };

  const bulkGenerateListings = async () => {
    const selected = getSelectedCards();
    setIsGenerating(true);
    
    try {
      const updated = await Promise.all(
        selected.map(async (card) => {
          try {
            const listingCopy = await generateListingCopy(card, listingModel);
            return {
              ...card,
              status: 'listing' as const,
              listingInfo: {
                ...card.listingInfo,
                listedDate: card.listingInfo?.listedDate || new Date().toISOString(),
                listingCopy
              }
            };
          } catch (error) {
            console.error(`Failed to generate listing for ${card.name}:`, error);
            return card;
          }
        })
      );

      for (const card of updated) {
        await api.updateCard(card);
        onUpdateCard(card);
      }
    } finally {
      setIsGenerating(false);
      setSelectedIds(new Set());
    }
  };

  const exportListings = async () => {
    setIsExporting(true);
    try {
      const selected = getSelectedCards();
      const exportData = selected.map(card => ({
        name: card.name,
        set: card.set,
        cardNumber: card.cardNumber,
        condition: card.grading.overallCondition,
        status: card.status,
        listingPrice: card.listingInfo?.listingPrice || card.suggestedPrice.mid,
        soldPrice: card.listingInfo?.soldPrice,
        listedDate: card.listingInfo?.listedDate,
        soldDate: card.listingInfo?.soldDate,
        platforms: card.listingInfo?.platforms?.join(', ') || '',
        listingTitle: card.listingInfo?.listingCopy?.title || '',
        notes: card.listingInfo?.notes || ''
      }));

      const csv = [
        Object.keys(exportData[0] || {}).join(','),
        ...exportData.map(row => Object.values(row).map(v => `"${v}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `listings-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const copyListingText = (card: CardMetadata, type: 'title' | 'ebay' | 'tcg') => {
    const text = card.listingInfo?.listingCopy?.[type] || '';
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedId(`${card.id}-${type}`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'listing': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'sold': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const stats = useMemo(() => {
    const all = filteredCards.length;
    const inventory = filteredCards.filter(c => c.status === 'inventory').length;
    const listing = filteredCards.filter(c => c.status === 'listing').length;
    const sold = filteredCards.filter(c => c.status === 'sold').length;
    const totalValue = filteredCards.reduce((sum, c) => sum + (c.listingInfo?.listingPrice || c.suggestedPrice.mid), 0);
    
    return { all, inventory, listing, sold, totalValue };
  }, [filteredCards]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Listing Manager</h1>
          <p className="text-gray-500 mt-1">Manage your card listings and track sales</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={bulkGenerateListings}
                disabled={isGenerating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                Generate Listings ({selectedIds.size})
              </button>
              <button
                onClick={exportListings}
                disabled={isExporting}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Export ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'All', value: stats.all, color: 'bg-gray-100 text-gray-700' },
          { label: 'Inventory', value: stats.inventory, color: 'bg-blue-100 text-blue-700' },
          { label: 'Listed', value: stats.listing, color: 'bg-orange-100 text-orange-700' },
          { label: 'Sold', value: stats.sold, color: 'bg-green-100 text-green-700' },
          { label: 'Total Value', value: `$${stats.totalValue.toFixed(0)}`, color: 'bg-indigo-100 text-indigo-700' }
        ].map((stat, i) => (
          <div key={i} className={`${stat.color} p-4 rounded-2xl font-bold`}>
            <div className="text-xs opacity-80 mb-1">{stat.label}</div>
            <div className="text-xl">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, set, or card number..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            {(['all', 'inventory', 'listing', 'sold'] as StatusFilter[]).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                  statusFilter === status
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-');
              setSortField(field as SortField);
              setSortDirection(dir as 'asc' | 'desc');
            }}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="price-desc">Price High-Low</option>
            <option value="price-asc">Price Low-High</option>
            <option value="status-asc">Status</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-indigo-900">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <button
                onClick={bulkMarkAsListed}
                className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors"
              >
                Mark as Listed
              </button>
              <button
                onClick={bulkMarkAsSold}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
              >
                Mark as Sold
              </button>
              <button
                onClick={bulkMarkAsInventory}
                className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
              >
                Back to Inventory
              </button>
            </div>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Cards Table/Grid */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-indigo-600"
                  >
                    {selectedIds.size === filteredCards.length && filteredCards.length > 0 ? (
                      <CheckSquare size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Card</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Listed Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Platforms</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No cards found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredCards.map(card => (
                  <tr key={card.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelect(card.id)}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        {selectedIds.has(card.id) ? (
                          <CheckSquare size={18} className="text-indigo-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {card.images && card.images.length > 0 && (
                          <img src={card.images[0]} alt={card.name} className="w-12 h-16 object-cover rounded-md" />
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{card.name}</div>
                          <div className="text-xs text-gray-500">{card.set} • #{card.cardNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
                        {card.grading.overallCondition || (card.grading as any).overallGrade || 'NM'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${getStatusColor(card.status)}`}>
                        {card.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        ${card.listingInfo?.listingPrice?.toFixed(2) || card.suggestedPrice.mid.toFixed(2)}
                      </div>
                      {card.listingInfo?.soldPrice && (
                        <div className="text-xs text-green-600">Sold: ${card.listingInfo.soldPrice.toFixed(2)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {card.listingInfo?.listedDate
                        ? new Date(card.listingInfo.listedDate).toLocaleDateString()
                        : card.listingInfo?.soldDate
                        ? new Date(card.listingInfo.soldDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {card.listingInfo?.platforms?.map((platform, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold">
                            {platform}
                          </span>
                        ))}
                        {(!card.listingInfo?.platforms || card.listingInfo.platforms.length === 0) && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {card.listingInfo?.listingCopy && (
                          <>
                            <button
                              onClick={() => copyListingText(card, 'title')}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Copy title"
                            >
                              {copiedId === `${card.id}-title` ? (
                                <Check size={14} className="text-green-600" />
                              ) : (
                                <FileText size={14} className="text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={() => copyListingText(card, 'ebay')}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Copy eBay description"
                            >
                              {copiedId === `${card.id}-ebay` ? (
                                <Check size={14} className="text-green-600" />
                              ) : (
                                <ShoppingCart size={14} className="text-gray-600" />
                              )}
                            </button>
                          </>
                        )}
                        {card.marketData?.tcgplayer?.url && (
                          <a
                            href={card.marketData.tcgplayer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View on TCGPlayer"
                          >
                            <ExternalLink size={14} className="text-gray-600" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ListingsManager;
