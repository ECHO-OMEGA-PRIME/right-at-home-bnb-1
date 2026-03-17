'use client';

import { useState, useMemo } from 'react';
import {
  Package, Plus, Search, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, ArrowRightLeft,
  X, DollarSign, Warehouse,
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type Category = 'Linens' | 'Toiletries' | 'Cleaning Supplies' | 'Kitchen' | 'Maintenance';

interface InventoryItem {
  id: string; name: string; category: Category; quantity: number;
  reorderPoint: number; unitCost: number; location: string; sku: string; lastRestocked: string;
}

const PROPERTIES = [
  'Central Warehouse', 'Desert Rose Villa', 'Permian Sunset', 'Basin View Loft',
  'Wildcatter Suite', 'Oil Patch Palace', 'Derrick Heights', 'Pump Jack Place',
  'Midland Manor', 'West Texas Haven', 'Roughneck Retreat', 'Pumpjack Patio',
  'Lone Star Lodge', 'Tumbleweed Terrace', 'Cactus Creek Cottage', 'Mesquite Meadows',
  'Prairie Wind Place', 'Sandstorm Suite', 'Rig Runner Ranch', 'Oilfield Oasis',
  'Panhandle Paradise', 'Dusty Trail Duplex', 'Horizon Heights',
];

const INITIAL_ITEMS: InventoryItem[] = [
  { id: 'INV001', name: 'Queen Bed Sheet Set (White)', category: 'Linens', quantity: 48, reorderPoint: 20, unitCost: 3500, location: 'Central Warehouse', sku: 'LIN-QSS-WHT', lastRestocked: '2026-03-10' },
  { id: 'INV002', name: 'King Bed Sheet Set (White)', category: 'Linens', quantity: 32, reorderPoint: 15, unitCost: 4200, location: 'Central Warehouse', sku: 'LIN-KSS-WHT', lastRestocked: '2026-03-10' },
  { id: 'INV003', name: 'Bath Towel Set (4-Pack)', category: 'Linens', quantity: 65, reorderPoint: 30, unitCost: 2800, location: 'Central Warehouse', sku: 'LIN-BTS-4PK', lastRestocked: '2026-03-08' },
  { id: 'INV004', name: 'Hand Towel Set (6-Pack)', category: 'Linens', quantity: 40, reorderPoint: 25, unitCost: 1800, location: 'Central Warehouse', sku: 'LIN-HTS-6PK', lastRestocked: '2026-03-08' },
  { id: 'INV005', name: 'Pillow (Standard)', category: 'Linens', quantity: 18, reorderPoint: 20, unitCost: 1500, location: 'Central Warehouse', sku: 'LIN-PLW-STD', lastRestocked: '2026-02-28' },
  { id: 'INV006', name: 'Duvet Cover (Queen)', category: 'Linens', quantity: 12, reorderPoint: 10, unitCost: 5500, location: 'Central Warehouse', sku: 'LIN-DCV-QN', lastRestocked: '2026-02-15' },
  { id: 'INV007', name: 'Shampoo (Travel Size, 50-ct)', category: 'Toiletries', quantity: 8, reorderPoint: 10, unitCost: 2500, location: 'Central Warehouse', sku: 'TOI-SHP-50', lastRestocked: '2026-03-05' },
  { id: 'INV008', name: 'Conditioner (Travel Size, 50-ct)', category: 'Toiletries', quantity: 6, reorderPoint: 10, unitCost: 2500, location: 'Central Warehouse', sku: 'TOI-CND-50', lastRestocked: '2026-03-05' },
  { id: 'INV009', name: 'Body Wash (Travel Size, 50-ct)', category: 'Toiletries', quantity: 9, reorderPoint: 10, unitCost: 2200, location: 'Central Warehouse', sku: 'TOI-BWS-50', lastRestocked: '2026-03-05' },
  { id: 'INV010', name: 'Hand Soap Dispenser Refill (1 gal)', category: 'Toiletries', quantity: 15, reorderPoint: 8, unitCost: 1800, location: 'Central Warehouse', sku: 'TOI-HSR-1G', lastRestocked: '2026-03-12' },
  { id: 'INV011', name: 'Toilet Paper (96-roll case)', category: 'Toiletries', quantity: 4, reorderPoint: 5, unitCost: 6500, location: 'Central Warehouse', sku: 'TOI-TP-96', lastRestocked: '2026-03-01' },
  { id: 'INV012', name: 'Facial Tissue Boxes (36-ct)', category: 'Toiletries', quantity: 7, reorderPoint: 6, unitCost: 3200, location: 'Central Warehouse', sku: 'TOI-FTB-36', lastRestocked: '2026-03-01' },
  { id: 'INV013', name: 'All-Purpose Cleaner (1 gal)', category: 'Cleaning Supplies', quantity: 22, reorderPoint: 10, unitCost: 1200, location: 'Central Warehouse', sku: 'CLN-APC-1G', lastRestocked: '2026-03-14' },
  { id: 'INV014', name: 'Glass Cleaner (32 oz)', category: 'Cleaning Supplies', quantity: 18, reorderPoint: 10, unitCost: 450, location: 'Central Warehouse', sku: 'CLN-GLC-32', lastRestocked: '2026-03-14' },
  { id: 'INV015', name: 'Disinfectant Spray (12-pack)', category: 'Cleaning Supplies', quantity: 5, reorderPoint: 6, unitCost: 4800, location: 'Central Warehouse', sku: 'CLN-DSP-12', lastRestocked: '2026-03-07' },
  { id: 'INV016', name: 'Trash Bags (200-ct, 13 gal)', category: 'Cleaning Supplies', quantity: 11, reorderPoint: 5, unitCost: 2800, location: 'Central Warehouse', sku: 'CLN-TRB-200', lastRestocked: '2026-03-10' },
  { id: 'INV017', name: 'Laundry Detergent (HE, 150 oz)', category: 'Cleaning Supplies', quantity: 14, reorderPoint: 6, unitCost: 2200, location: 'Central Warehouse', sku: 'CLN-LDT-150', lastRestocked: '2026-03-10' },
  { id: 'INV018', name: 'Microfiber Cloth Pack (24-ct)', category: 'Cleaning Supplies', quantity: 3, reorderPoint: 5, unitCost: 1800, location: 'Central Warehouse', sku: 'CLN-MFC-24', lastRestocked: '2026-02-20' },
  { id: 'INV019', name: 'Coffee Pods (K-Cup, 80-ct)', category: 'Kitchen', quantity: 25, reorderPoint: 15, unitCost: 3800, location: 'Central Warehouse', sku: 'KIT-KCU-80', lastRestocked: '2026-03-12' },
  { id: 'INV020', name: 'Paper Towel Rolls (12-pack)', category: 'Kitchen', quantity: 19, reorderPoint: 10, unitCost: 1600, location: 'Central Warehouse', sku: 'KIT-PTR-12', lastRestocked: '2026-03-12' },
  { id: 'INV021', name: 'Dish Soap (32 oz)', category: 'Kitchen', quantity: 30, reorderPoint: 12, unitCost: 350, location: 'Central Warehouse', sku: 'KIT-DSP-32', lastRestocked: '2026-03-14' },
  { id: 'INV022', name: 'Dishwasher Pods (45-ct)', category: 'Kitchen', quantity: 16, reorderPoint: 8, unitCost: 1800, location: 'Central Warehouse', sku: 'KIT-DWP-45', lastRestocked: '2026-03-08' },
  { id: 'INV023', name: 'Sugar Packets (200-ct)', category: 'Kitchen', quantity: 10, reorderPoint: 5, unitCost: 900, location: 'Central Warehouse', sku: 'KIT-SGP-200', lastRestocked: '2026-03-01' },
  { id: 'INV024', name: 'Creamer Cups (100-ct)', category: 'Kitchen', quantity: 8, reorderPoint: 5, unitCost: 1200, location: 'Central Warehouse', sku: 'KIT-CRM-100', lastRestocked: '2026-03-01' },
  { id: 'INV025', name: 'HVAC Filters (20x25x1, 6-pack)', category: 'Maintenance', quantity: 4, reorderPoint: 6, unitCost: 4500, location: 'Central Warehouse', sku: 'MNT-HVF-6PK', lastRestocked: '2026-02-15' },
  { id: 'INV026', name: 'Light Bulbs LED (A19, 12-pack)', category: 'Maintenance', quantity: 10, reorderPoint: 5, unitCost: 2400, location: 'Central Warehouse', sku: 'MNT-LBL-12', lastRestocked: '2026-03-05' },
  { id: 'INV027', name: 'Smoke Detector Batteries (9V, 8-pk)', category: 'Maintenance', quantity: 3, reorderPoint: 4, unitCost: 1600, location: 'Central Warehouse', sku: 'MNT-SMB-8', lastRestocked: '2026-01-20' },
  { id: 'INV028', name: 'Plumbing Repair Kit', category: 'Maintenance', quantity: 6, reorderPoint: 3, unitCost: 3200, location: 'Central Warehouse', sku: 'MNT-PRK-01', lastRestocked: '2026-02-28' },
  { id: 'INV029', name: 'Touch-Up Paint (White, Qt)', category: 'Maintenance', quantity: 8, reorderPoint: 4, unitCost: 1800, location: 'Central Warehouse', sku: 'MNT-TUP-WQ', lastRestocked: '2026-02-28' },
  { id: 'INV030', name: 'Door Lock Batteries (AA, 48-pk)', category: 'Maintenance', quantity: 5, reorderPoint: 3, unitCost: 2200, location: 'Central Warehouse', sku: 'MNT-DLB-48', lastRestocked: '2026-03-10' },
];

const CATEGORIES: Category[] = ['Linens', 'Toiletries', 'Cleaning Supplies', 'Kitchen', 'Maintenance'];
const categoryColor = (cat: Category) => { switch (cat) { case 'Linens': return 'bg-blue-100 text-blue-700'; case 'Toiletries': return 'bg-pink-100 text-pink-700'; case 'Cleaning Supplies': return 'bg-green-100 text-green-700'; case 'Kitchen': return 'bg-orange-100 text-orange-700'; case 'Maintenance': return 'bg-purple-100 text-purple-700'; } };
type ModalMode = 'add' | 'use' | 'transfer';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_ITEMS);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementQty, setMovementQty] = useState(1);
  const [transferDest, setTransferDest] = useState(PROPERTIES[1]);

  const filtered = useMemo(() => items.filter((item) => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.sku.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== 'All' && item.category !== catFilter) return false;
    if (showLowOnly && item.quantity >= item.reorderPoint) return false;
    return true;
  }), [items, search, catFilter, showLowOnly]);

  const lowStockCount = items.filter((i) => i.quantity < i.reorderPoint).length;
  const totalValue = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, { count: number; value: number }> = {};
    for (const cat of CATEGORIES) { const catItems = items.filter((i) => i.category === cat); totals[cat] = { count: catItems.reduce((s, i) => s + i.quantity, 0), value: catItems.reduce((s, i) => s + i.quantity * i.unitCost, 0) }; }
    return totals;
  }, [items]);

  function openMovement(item: InventoryItem, mode: ModalMode) { setSelectedItem(item); setModalMode(mode); setMovementQty(1); setTransferDest(PROPERTIES[1]); }

  function applyMovement() {
    if (!selectedItem) return;
    setItems((prev) => prev.map((i) => {
      if (i.id !== selectedItem.id) return i;
      if (modalMode === 'add') return { ...i, quantity: i.quantity + movementQty, lastRestocked: '2026-03-17' };
      if (modalMode === 'use') return { ...i, quantity: Math.max(0, i.quantity - movementQty) };
      if (modalMode === 'transfer') return { ...i, quantity: Math.max(0, i.quantity - movementQty) };
      return i;
    }));
    setModalMode(null); setSelectedItem(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8"><h1 className="text-3xl font-bold text-[#500000]">Inventory Management</h1><p className="text-gray-600 mt-1">Track supplies across 22 rental properties</p></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-[#500000] bg-opacity-10 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-[#500000]" /></div><div><p className="text-xs text-gray-500 uppercase">Total SKUs</p><p className="text-2xl font-bold text-[#500000]">{items.length}</p></div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><Warehouse className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500 uppercase">Total Units</p><p className="text-2xl font-bold text-blue-600">{totalItems.toLocaleString()}</p></div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500 uppercase">Total Value</p><p className="text-2xl font-bold text-green-600">{formatMoney(totalValue)}</p></div></div></div>
          <div className={`rounded-xl shadow-sm border p-5 ${lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}><div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}><AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-500'}`} /></div><div><p className="text-xs text-gray-500 uppercase">Low Stock</p><p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>{lowStockCount}</p></div></div></div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          {CATEGORIES.map((cat) => (<div key={cat} className="bg-white rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500 mb-1">{cat}</p><p className="text-lg font-bold text-[#500000]">{categoryTotals[cat]?.count ?? 0} units</p><p className="text-xs text-gray-400">{formatMoney(categoryTotals[cat]?.value ?? 0)}</p></div>))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000] text-sm" /></div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#500000]"><option value="All">All Categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <button onClick={() => setShowLowOnly(!showLowOnly)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${showLowOnly ? 'bg-red-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}><AlertTriangle className="w-4 h-4" /> Low Stock Only</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-[#500000] text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold">Item</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Reorder At</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Unit Cost</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => {
                  const isLow = item.quantity < item.reorderPoint;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isLow ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3"><div className="flex items-center gap-2">{isLow && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}<div><p className="font-medium text-gray-900 text-sm">{item.name}</p><p className="text-xs text-gray-400">Last restocked: {item.lastRestocked}</p></div></div></td>
                      <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${categoryColor(item.category)}`}>{item.category}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold text-sm ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-500">{item.reorderPoint}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatMoney(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{formatMoney(item.quantity * item.unitCost)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.location}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                        <button onClick={() => openMovement(item, 'add')} className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors" title="Add Stock"><ArrowDownCircle className="w-4 h-4" /></button>
                        <button onClick={() => openMovement(item, 'use')} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Use Stock"><ArrowUpCircle className="w-4 h-4" /></button>
                        <button onClick={() => openMovement(item, 'transfer')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Transfer"><ArrowRightLeft className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="p-12 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-3 text-gray-300" /><p className="font-medium">No items found</p></div>}
        </div>

        {lowStockCount > 0 && !showLowOnly && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-5 h-5 text-red-600" /><h3 className="font-bold text-red-700">Low Stock Alerts ({lowStockCount} items)</h3></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.filter((i) => i.quantity < i.reorderPoint).map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                  <div><p className="text-sm font-medium text-gray-900">{item.name}</p><p className="text-xs text-gray-500">{item.sku}</p></div>
                  <div className="text-right"><p className="text-sm font-bold text-red-600">{item.quantity} / {item.reorderPoint}</p><p className="text-xs text-red-500">Need {item.reorderPoint - item.quantity} more</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {modalMode && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className={`p-6 rounded-t-2xl ${modalMode === 'add' ? 'bg-green-600' : modalMode === 'use' ? 'bg-amber-600' : 'bg-blue-600'} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {modalMode === 'add' && <ArrowDownCircle className="w-6 h-6" />}
                    {modalMode === 'use' && <ArrowUpCircle className="w-6 h-6" />}
                    {modalMode === 'transfer' && <ArrowRightLeft className="w-6 h-6" />}
                    <h2 className="text-lg font-bold">{modalMode === 'add' ? 'Add Stock' : modalMode === 'use' ? 'Use Stock' : 'Transfer Stock'}</h2>
                  </div>
                  <button onClick={() => setModalMode(null)} className="p-2 hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm font-semibold text-gray-900">{selectedItem.name}</p><p className="text-xs text-gray-500 mt-1">{selectedItem.sku} | Current: {selectedItem.quantity} units | Location: {selectedItem.location}</p></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label><input type="number" value={movementQty} onChange={(e) => setMovementQty(Math.max(1, Number(e.target.value)))} min={1} max={modalMode === 'use' || modalMode === 'transfer' ? selectedItem.quantity : 9999} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]" /></div>
                {modalMode === 'transfer' && <div><label className="block text-sm font-semibold text-gray-700 mb-1">Destination Property</label><select value={transferDest} onChange={(e) => setTransferDest(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#500000]">{PROPERTIES.filter((p) => p !== selectedItem.location).map((p) => <option key={p} value={p}>{p}</option>)}</select></div>}
                <div className="bg-gray-50 rounded-lg p-3 text-sm"><p className="text-gray-600">
                  {modalMode === 'add' && `New quantity: ${selectedItem.quantity} + ${movementQty} = ${selectedItem.quantity + movementQty}`}
                  {modalMode === 'use' && `New quantity: ${selectedItem.quantity} - ${movementQty} = ${Math.max(0, selectedItem.quantity - movementQty)}`}
                  {modalMode === 'transfer' && `Transfer ${movementQty} units to ${transferDest}. Remaining: ${Math.max(0, selectedItem.quantity - movementQty)}`}
                </p></div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t">
                <button onClick={() => setModalMode(null)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={applyMovement} className={`px-5 py-2.5 text-white rounded-lg font-semibold transition-colors ${modalMode === 'add' ? 'bg-green-600 hover:bg-green-700' : modalMode === 'use' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{modalMode === 'add' ? 'Add Stock' : modalMode === 'use' ? 'Use Stock' : 'Transfer'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
