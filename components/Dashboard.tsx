
import React from 'react';
import { CardMetadata } from '../types';
import { TrendingUp, Package, DollarSign, Clock, Camera } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  inventory: CardMetadata[];
  isLoading?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ inventory, isLoading }) => {
  const totalValue = inventory.reduce((acc, card) => acc + (card.suggestedPrice?.mid || 0), 0);
  const recentCards = inventory.slice(-4).reverse();

  // Mock aggregate data for the dashboard chart
  const portfolioHistory = [
    { name: 'Mon', value: totalValue * 0.9 || 100 },
    { name: 'Tue', value: totalValue * 0.92 || 110 },
    { name: 'Wed', value: totalValue * 0.95 || 105 },
    { name: 'Thu', value: totalValue * 0.98 || 120 },
    { name: 'Fri', value: totalValue || 145 },
  ];

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <header className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-4 bg-gray-100 rounded w-64 animate-pulse" />
        </header>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="bg-gray-100 p-3 rounded-xl w-12 h-12" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-100 rounded w-20" />
                  <div className="h-6 bg-gray-100 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 animate-pulse">
            <div className="h-6 bg-gray-100 rounded w-32 mb-6" />
            <div className="h-48 bg-gray-50 rounded w-full" />
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-pulse">
            <div className="h-6 bg-gray-100 rounded w-32 mb-6" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-12 h-16 bg-gray-100 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Market Overview</h1>
        <p className="text-gray-500">Track your trading card portfolio performance</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: 'Portfolio Value', value: `$${totalValue.toLocaleString()}`, icon: DollarSign, color: 'bg-green-100 text-green-600' },
          { label: 'Total Inventory', value: inventory.length, icon: Package, color: 'bg-blue-100 text-blue-600' },
          { label: 'Active Listings', value: '12', icon: Clock, color: 'bg-orange-100 text-orange-600' },
          { label: 'Market Trend', value: '+14.2%', icon: TrendingUp, color: 'bg-indigo-100 text-indigo-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <div className={`${stat.color} p-3 rounded-xl w-fit`}>
                <stat.icon size={20} className="md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-lg md:text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Portfolio Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">Recent Scans</h3>
          <div className="space-y-4">
            {recentCards.length > 0 ? (
              recentCards.map((card) => (
                <div key={card.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer">
                  {card.images && card.images.length > 0 ? (
                     <img src={card.images[0]} alt={card.name} className="w-12 h-16 object-cover rounded-md shadow-sm" />
                  ) : (
                     <div className="w-12 h-16 bg-gray-100 rounded-md shadow-sm flex items-center justify-center text-gray-400">
                       <Camera size={20} />
                     </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate text-sm">{card.name}</p>
                    <p className="text-xs text-gray-500 truncate">{card.set} • {card.cardNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600 text-sm">${card.suggestedPrice.mid}</p>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase font-bold">{card.grading.overallCondition || (card.grading as any).overallGrade || 'NM'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No recent scans. Scan a card to begin.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
