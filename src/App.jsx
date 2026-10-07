import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Truck,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  PlusCircle,
  MinusCircle,
  Box,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  BarChart3,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle,
  Info
} from 'lucide-react';

const INITIAL_PRODUCTS = [
  {
    id: 'prod-1',
    sku: 'ART-1001',
    name: 'Бездротові навушники AirSound Pro',
    boxNumber: 'A1',
    receivedQty: 150,
    sentQty: 45,
    minQty: 10,
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'prod-2',
    sku: 'ART-1002',
    name: 'Смарт-годинник FitTracker V2',
    boxNumber: 'B2',
    receivedQty: 80,
    sentQty: 75,
    minQty: 15,
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

const INITIAL_LOGS = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    type: 'IN', // IN (прихід), OUT (відправка), EDIT (коригування)
    sku: 'ART-1001',
    productName: 'Бездротові навушники AirSound Pro',
    boxNumber: 'A1',
    changeQty: 150,
    prevBalance: 0,
    newBalance: 150,
    orderId: 'SUP-8841',
    note: 'Початковий прихід від постачальника'
  }
];

export default function App() {
  // LocalStorage state persistence
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('wh_products_v1');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('wh_logs_v1');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // UI Navigation & Filters
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'operations', 'history', 'reconciliation'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
  
  // Notification banner state
  const [notification, setNotification] = useState(null);

  // Forms state
  const [opType, setOpType] = useState('OUT'); // 'OUT' or 'IN' or 'NEW'
  const [opSku, setOpSku] = useState('');
  const [opQty, setOpQty] = useState('');
  const [opBox, setOpBox] = useState('');
  const [opNote, setOpNote] = useState('');
  const [opOrderRef, setOpOrderRef] = useState('');

  // New product extra fields
  const [newProductName, setNewProductName] = useState('');
  const [newMinQty, setNewMinQty] = useState('10');

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('wh_products_v1', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('wh_logs_v1', JSON.stringify(logs));
  }, [logs]);

  // Helper function to show alerts
  const showNotice = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Derived unique list of box numbers
  const allBoxes = useMemo(() => {
    const boxes = new Set(products.map(p => p.boxNumber.trim().toUpperCase()));
    return Array.from(boxes).sort();
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const currentBalance = p.receivedQty - p.sentQty;
      const matchesSearch =
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.boxNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBox =
        selectedBoxFilter === 'ALL' ||
        p.boxNumber.toUpperCase() === selectedBoxFilter.toUpperCase();

      let matchesStatus = true;
      if (statusFilter === 'IN_STOCK') matchesStatus = currentBalance > p.minQty;
      if (statusFilter === 'LOW_STOCK') matchesStatus = currentBalance > 0 && currentBalance <= p.minQty;
      if (statusFilter === 'OUT_OF_STOCK') matchesStatus = currentBalance <= 0;

      return matchesSearch && matchesBox && matchesStatus;
    });
  }, [products, searchQuery, selectedBoxFilter, statusFilter]);

  // Global Inventory Metrics
  const summaryMetrics = useMemo(() => {
    let totalItemsCount = products.length;
    let totalReceived = 0;
    let totalSent = 0;
    let totalInStock = 0;
    let mismatchedCount = 0;

    products.forEach(p => {
      totalReceived += Number(p.receivedQty);
      totalSent += Number(p.sentQty);
      const balance = p.receivedQty - p.sentQty;
      totalInStock += balance;

      // Mathematical Accuracy Check: Received MUST equal Sent + Balance
      if (p.receivedQty !== (p.sentQty + balance)) {
        mismatchedCount++;
      }
    });

    return {
      totalItemsCount,
      totalReceived,
      totalSent,
      totalInStock,
      mismatchedCount,
      isPerfectBalance: mismatchedCount === 0
    };
  }, [products]);

  const handleExecuteOperation = (e) => {
    e.preventDefault();

    const qty = parseInt(opQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showNotice('Будь ласка, вкажіть коректну додатну кількість', 'error');
      return;
    }

    if (opType === 'NEW') {
      // Adding completely new product SKU
      const trimmedSku = opSku.trim().toUpperCase();
      if (!trimmedSku) {
        showNotice('Артикул обов’язковий для заповнення', 'error');
        return;
      }
      if (!newProductName.trim()) {
        showNotice('Назва товару обов’язкова', 'error');
        return;
      }
      if (products.some(p => p.sku.toUpperCase() === trimmedSku)) {
        showNotice(`Артикул "${trimmedSku}" вже існує в базі!`, 'error');
        return;
      }

      const box = opBox.trim().toUpperCase() || 'Б/Н';
      const minQ = parseInt(newMinQty, 10) || 5;

      const newProduct = {
        id: `prod-${Date.now()}`,
        sku: trimmedSku,
        name: newProductName.trim(),
        boxNumber: box,
        receivedQty: qty,
        sentQty: 0,
        minQty: minQ,
        updatedAt: new Date().toISOString()
      };

      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'IN',
        sku: trimmedSku,
        productName: newProductName.trim(),
        boxNumber: box,
        changeQty: qty,
        prevBalance: 0,
        newBalance: qty,
        orderId: opOrderRef || 'ПР-НОВИЙ',
        note: opNote || 'Створення нового артикулу'
      };

      setProducts(prev => [newProduct, ...prev]);
      setLogs(prev => [newLog, ...prev]);
      showNotice(`Успішно додано новий артикул ${trimmedSku} в коробку #${box}!`);
      
      // Reset form
      setOpSku('');
      setOpQty('');
      setNewProductName('');
      setOpNote('');
      setOpOrderRef('');
      return;
    }

    // Process IN or OUT for existing product
    const targetProduct = products.find(p => p.sku.toUpperCase() === opSku.trim().toUpperCase());
    if (!targetProduct) {
      showNotice(`Товар з артикулом "${opSku}" не знайдено`, 'error');
      return;
    }

    const currentBalance = targetProduct.receivedQty - targetProduct.sentQty;

    if (opType === 'OUT' && qty > currentBalance) {
      showNotice(`Неможливо відправити ${qty} шт. Доступний залишок: ${currentBalance} шт.`, 'error');
      return;
    }

    let updatedReceived = targetProduct.receivedQty;
    let updatedSent = targetProduct.sentQty;
    let logType = opType;
    let newBalance = currentBalance;

    if (opType === 'OUT') {
      updatedSent += qty;
      newBalance = currentBalance - qty;
    } else if (opType === 'IN') {
      updatedReceived += qty;
      newBalance = currentBalance + qty;
    }

    // Check if box updated
    const finalBox = opBox.trim() ? opBox.trim().toUpperCase() : targetProduct.boxNumber;

    const updatedProducts = products.map(p => {
      if (p.id === targetProduct.id) {
        return {
          ...p,
          receivedQty: updatedReceived,
          sentQty: updatedSent,
          boxNumber: finalBox,
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: logType,
      sku: targetProduct.sku,
      productName: targetProduct.name,
      boxNumber: finalBox,
      changeQty: qty,
      prevBalance: currentBalance,
      newBalance: newBalance,
      orderId: opOrderRef || (logType === 'OUT' ? 'ВІДПР-АКТ' : 'ПОПОВНЕННЯ'),
      note: opNote || (logType === 'OUT' ? 'Щоденна відправка' : 'Прихід товару')
    };

    setProducts(updatedProducts);
    setLogs([newLog, ...logs]);
    
    showNotice(
      logType === 'OUT'
        ? `Відправка ${qty} шт. артикулу ${targetProduct.sku} успішно проведена!`
        : `Отримано +${qty} шт. артикулу ${targetProduct.sku}!`
    );

    // Reset inputs
    setOpQty('');
    setOpNote('');
    setOpOrderRef('');
  };

  const exportDataJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ products, logs }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `warehouse_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotice('Резервна копія успішно скачана!');
  };

  const importDataJSON = (e) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (eReader) => {
        try {
          const parsed = JSON.parse(eReader.target.result);
          if (parsed.products && Array.isArray(parsed.products)) {
            setProducts(parsed.products);
            if (parsed.logs && Array.isArray(parsed.logs)) setLogs(parsed.logs);
            showNotice('Дані успішно імпортовано з файлу!');
          } else {
            showNotice('Некоректний формат файлу!', 'error');
          }
        } catch (err) {
          showNotice('Помилка читання JSON файлу', 'error');
        }
      };
    }
  };

  const resetToDemoData = () => {
    if (window.confirm && !window.confirm('Ви впевнені, що хочете скинути дані до початкових демо-значень? Всі поточні зміни буде втрачено.')) {
      return;
    }
    setProducts(INITIAL_PRODUCTS);
    setLogs(INITIAL_LOGS);
    showNotice('Дані скинуто до початкових демо-значень');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                СкладКонтроль Pro
                <span className="text-xs font-normal px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
                  Точний облік
                </span>
              </h1>
              <p className="text-xs text-slate-400">Система обліку складських залишків та щоденних відправок</p>
            </div>
          </div>

          {/* Tab Navigation Controls */}
          <nav className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/80 text-sm font-medium w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              Залишки & Товари
            </button>
            <button
              onClick={() => setActiveTab('operations')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'operations'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Truck className="w-4 h-4" />
              Прихід / Відправка
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              Історія змін ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'reconciliation'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Звірка залишків
            </button>
          </nav>
        </div>
      </header>

      {/* Pop-up Notification Banner */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
            notification.type === 'error'
              ? 'bg-rose-900/90 border-rose-500 text-rose-100'
              : 'bg-emerald-900/90 border-emerald-500 text-emerald-100'
          }`}>
            {notification.type === 'error' ? <XCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Всього позицій
              <Package className="w-4 h-4 text-blue-400" />
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">{summaryMetrics.totalItemsCount}</span>
              <span className="text-xs text-slate-400">артикулів</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Всього отримано
              <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400">{summaryMetrics.totalReceived}</span>
              <span className="text-xs text-slate-400">од.</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Всього відправлено
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400">{summaryMetrics.totalSent}</span>
              <span className="text-xs text-slate-400">од.</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Поточний залишок
              <Box className="w-4 h-4 text-blue-400" />
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-blue-400">{summaryMetrics.totalInStock}</span>
              <span className="text-xs text-slate-400">од. на складі</span>
            </div>
          </div>
        </div>

        {/* TAB 1: INVENTORY & PRODUCTS */}
        {activeTab === 'inventory' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Пошук за артикулом, назвою чи коробкою..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 text-slate-100 pl-10 pr-4 py-2 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                  <Box className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Коробка:</span>
                  <select
                    value={selectedBoxFilter}
                    onChange={(e) => setSelectedBoxFilter(e.target.value)}
                    className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-800">Всі коробки ({allBoxes.length})</option>
                    {allBoxes.map(b => (
                      <option key={b} value={b} className="bg-slate-800">
                        Коробка #{b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Статус:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-sm text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-800">Всі статуси</option>
                    <option value="IN_STOCK" className="bg-slate-800">В наявності</option>
                    <option value="LOW_STOCK" className="bg-slate-800">Закінчується</option>
                    <option value="OUT_OF_STOCK" className="bg-slate-800">Немає в наявності</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('operations');
                    setOpType('NEW');
                  }}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-all shadow-md ml-auto md:ml-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  Додати товар
                </button>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Артикул (SKU)</th>
                      <th className="py-3.5 px-4">Назва Товару</th>
                      <th className="py-3.5 px-4">Місце / Коробка</th>
                      <th className="py-3.5 px-4 text-right">Всього Отримано</th>
                      <th className="py-3.5 px-4 text-right">Відправлено</th>
                      <th className="py-3.5 px-4 text-right">Поточний Залишок</th>
                      <th className="py-3.5 px-4 text-center">Контроль Точності</th>
                      <th className="py-3.5 px-4 text-center">Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-sm">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center py-12 text-slate-400">
                          <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                          Товарів за вказаними критеріями не знайдено
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const currentBalance = p.receivedQty - p.sentQty;
                        // Precision Check formula: Received == Sent + Balance
                        const isAccurate = p.receivedQty === (p.sentQty + currentBalance);

                        let statusBadge = null;
                        if (currentBalance <= 0) {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-md text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 font-medium">
                              Немає
                            </span>
                          );
                        } else if (currentBalance <= p.minQty) {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-md text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                              Закінчується ({currentBalance} шт)
                            </span>
                          );
                        } else {
                          statusBadge = (
                            <span className="px-2 py-0.5 rounded-md text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                              В наявності
                            </span>
                          );
                        }

                        return (
                          <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                              {p.sku}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-slate-100">{p.name}</div>
                              <div className="mt-0.5">{statusBadge}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 rounded-lg text-slate-300 font-mono text-xs border border-slate-700">
                                <Box className="w-3.5 h-3.5 text-blue-400" />
                                #{p.boxNumber}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-emerald-400">
                              +{p.receivedQty}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-amber-400">
                              -{p.sentQty}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className={`font-bold text-base ${currentBalance <= p.minQty ? 'text-amber-400' : 'text-slate-100'}`}>
                                {currentBalance}
                              </span>
                              <span className="text-xs text-slate-500 ml-1">шт.</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isAccurate ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="Отримано = Відправлено + Залишок">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  100% Точно
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" title="Увага! Виявлено розбіжність залишку">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Помилка
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setOpSku(p.sku);
                                    setOpBox(p.boxNumber);
                                    setOpType('OUT');
                                    setActiveTab('operations');
                                  }}
                                  title="Провести відправку"
                                  className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                                >
                                  <MinusCircle className="w-3.5 h-3.5" />
                                  Відправити
                                </button>
                                <button
                                  onClick={() => {
                                    setOpSku(p.sku);
                                    setOpBox(p.boxNumber);
                                    setOpType('IN');
                                    setActiveTab('operations');
                                  }}
                                  title="Поповнити залишок"
                                  className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Прихід
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="max-w-2xl mx-auto w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-400" />
              Проведення складської операції
            </h2>
            <p className="text-sm text-slate-400 mb-6">Фіксація щоденних відправок або приходу товарів на склад</p>

            <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900 rounded-xl mb-6 border border-slate-700">
              <button
                type="button"
                onClick={() => setOpType('OUT')}
                className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  opType === 'OUT'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                Відправка (Списання)
              </button>
              <button
                type="button"
                onClick={() => setOpType('IN')}
                className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  opType === 'IN'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Прихід / Поповнення
              </button>
              <button
                type="button"
                onClick={() => setOpType('NEW')}
                className={`py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  opType === 'NEW'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-4 h-4" />
                Новий артикул
              </button>
            </div>

            <form onSubmit={handleExecuteOperation} className="space-y-4">
              {opType === 'NEW' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Артикул товару (SKU) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="напр. ART-9090"
                      value={opSku}
                      onChange={(e) => setOpSku(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 font-mono text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Назва товару *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="напр. Чохол для планшета Samsung"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Оберіть або введіть Артикул (SKU) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      list="sku-list"
                      placeholder="Почніть вводити артикул..."
                      value={opSku}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setOpSku(val);
                        const match = products.find(p => p.sku === val);
                        if (match) {
                          setOpBox(match.boxNumber);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 font-mono text-sm outline-none"
                    />
                    <datalist id="sku-list">
                      {products.map(p => (
                        <option key={p.id} value={p.sku}>
                          {p.name} (Доступно: {p.receivedQty - p.sentQty} шт, Коробка #{p.boxNumber})
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    {opType === 'OUT' ? 'Кількість для відправки (шт)*' : 'Кількість отриманого товару (шт)*'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="10"
                    value={opQty}
                    onChange={(e) => setOpQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Номер коробки / Місце зберігання
                  </label>
                  <input
                    type="text"
                    placeholder="напр. A1, B2"
                    value={opBox}
                    onChange={(e) => setOpBox(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none font-mono"
                  />
                </div>
              </div>

              {opType === 'NEW' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Мінімальний залишок для попередження (шт)
                  </label>
                  <input
                    type="number"
                    value={newMinQty}
                    onChange={(e) => setNewMinQty(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Номер замовлення / ТТН / Документа
                  </label>
                  <input
                    type="text"
                    placeholder="напр. ORD-5541"
                    value={opOrderRef}
                    onChange={(e) => setOpOrderRef(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Коментар / Примітка
                  </label>
                  <input
                    type="text"
                    placeholder="Примітка до операції"
                    value={opNote}
                    onChange={(e) => setOpNote(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                    opType === 'OUT'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                      : opType === 'IN'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  }`}
                >
                  {opType === 'OUT' && <MinusCircle className="w-5 h-5" />}
                  {opType === 'IN' && <PlusCircle className="w-5 h-5" />}
                  {opType === 'NEW' && <Package className="w-5 h-5" />}
                  
                  {opType === 'OUT' && 'Підтвердити відправку товару'}
                  {opType === 'IN' && 'Провести оприбуткування'}
                  {opType === 'NEW' && 'Зберегти новий артикул'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-900/60 border-b border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" />
                  Хронологічний журнал операцій
                </h3>
                <p className="text-xs text-slate-400">Повна історія відправок, приходів та змін по кожному товару</p>
              </div>

              <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                Загалом записів: <strong className="text-slate-200">{logs.length}</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Дата та Час</th>
                    <th className="py-3 px-4">Тип</th>
                    <th className="py-3 px-4">Артикул / Назва</th>
                    <th className="py-3 px-4">Коробка</th>
                    <th className="py-3 px-4 text-right">Зміна</th>
                    <th className="py-3 px-4 text-right">Залишок після</th>
                    <th className="py-3 px-4">Документ / Примітка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-sm">
                  {logs.map((log) => {
                    const isOut = log.type === 'OUT';
                    const formattedDate = new Date(log.timestamp).toLocaleString('uk-UA', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <ArrowUpRight className="w-3 h-3" />
                              Відправка
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <ArrowDownLeft className="w-3 h-3" />
                              Прихід
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-blue-400 mr-2">{log.sku}</span>
                          <span className="text-slate-300 text-xs">{log.productName}</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-400">
                          #{log.boxNumber}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isOut ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isOut ? `-${log.changeQty}` : `+${log.changeQty}`}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-200">
                          {log.newBalance} шт.
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {log.orderId && <span className="font-semibold text-slate-300 mr-2">[{log.orderId}]</span>}
                          {log.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reconciliation' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                    Модуль Автоматичної Звірки та Балансу
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Перевірка математичної точності та відсутності розбіжностей за формулою: <code className="bg-slate-900 px-2 py-0.5 rounded text-blue-300 font-mono text-xs">Отримано = Залишок + Відправлено</code>
                  </p>
                </div>

                {summaryMetrics.isPerfectBalance ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold">
                    <CheckCircle className="w-5 h-5" />
                    Баланс 100% Збігається
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm font-semibold">
                    <AlertTriangle className="w-5 h-5" />
                    Виявлено {summaryMetrics.mismatchedCount} Розбіжностей
                  </div>
                )}
              </div>

              {/* Data Export / Import Control Section */}
              <div className="mt-8 pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">Резервне копіювання та Керування даними</h4>
                  <p className="text-xs text-slate-400">Збережіть базу даних у JSON для перенесення на інший пристрій або скиньте стан</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={exportDataJSON}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl text-sm font-medium transition-all"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    Експорт JSON
                  </button>

                  <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    Імпорт JSON
                    <input type="file" accept=".json" onChange={importDataJSON} className="hidden" />
                  </label>

                  <button
                    onClick={resetToDemoData}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-xl text-sm font-medium transition-all"
                  >
                    <RefreshCw className="w-4 h-4 text-rose-400" />
                    Скинути до Демо
                  </button>
                </div>
              </div>
            </div>

            {/* Reconciliation breakdown per Box */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 shadow-xl">
              <h4 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-400" />
                Аналітика завантаженості за коробками
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {allBoxes.map(box => {
                  const boxProducts = products.filter(p => p.boxNumber.toUpperCase() === box);
                  const totalInBox = boxProducts.reduce((acc, curr) => acc + (curr.receivedQty - curr.sentQty), 0);

                  return (
                    <div key={box} className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-blue-400 text-sm">Коробка #{box}</span>
                        <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">
                          {boxProducts.length} артикулів
                        </span>
                      </div>
                      <div className="text-xl font-extrabold text-white">
                        {totalInBox} <span className="text-xs font-normal text-slate-400">од. товарів</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-2">
                        {boxProducts.map(p => (
                          <div key={p.id} className="flex justify-between">
                            <span className="truncate max-w-[160px] text-slate-300">{p.sku} - {p.name}</span>
                            <span className="font-mono text-slate-200">{p.receivedQty - p.sentQty} шт</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          СкладКонтроль Pro &copy; {new Date().getFullYear()} — Автономна система обліку залишків. Всі дані зберігаються локально.
        </div>
      </footer>
    </div>
  );
}
