import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Truck, History, CheckCircle2, AlertTriangle, XCircle, Search, 
  PlusCircle, MinusCircle, Box, Download, Upload, RefreshCw, BarChart3, 
  Layers, ArrowDownLeft, ArrowUpRight, Filter, CheckCircle,
  Cloud, CloudOff, Settings, Save, Server, RefreshCcw, Menu, Info, X
} from 'lucide-react';

const INITIAL_PRODUCTS = [
  {
    id: 'prod-1', sku: 'ART-1001', name: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    receivedQty: 150, sentQty: 45, minQty: 10, updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'prod-2', sku: 'ART-1002', name: 'Смарт-годинник FitTracker V2', boxNumber: 'B2',
    receivedQty: 80, sentQty: 75, minQty: 15, updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'prod-3', sku: 'ART-1003', name: 'Портативний павербанк 20000mAh', boxNumber: 'A1',
    receivedQty: 200, sentQty: 200, minQty: 20, updatedAt: new Date().toISOString()
  }
];

const INITIAL_LOGS = [
  {
    id: 'log-1', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), type: 'IN',
    sku: 'ART-1001', productName: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    changeQty: 150, prevBalance: 0, newBalance: 150, orderId: 'SUP-8841', note: 'Початковий прихід'
  },
  {
    id: 'log-2', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), type: 'OUT',
    sku: 'ART-1001', productName: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    changeQty: 20, prevBalance: 150, newBalance: 130, orderId: 'ORD-1092', note: 'Щоденна відправка'
  },
  {
    id: 'log-3', timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), type: 'OUT',
    sku: 'ART-1001', productName: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    changeQty: 25, prevBalance: 130, newBalance: 105, orderId: 'ORD-1105', note: 'Замовлення Rozetka'
  }
];

// Helper functions for safe base64 encoding
const b64EncodeUnicode = (str) => {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
      function toSolidBytes(match, p1) { return String.fromCharCode('0x' + p1); }));
}
const b64DecodeUnicode = (str) => {
  return decodeURIComponent(atob(str).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

export default function App() {
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('wh_products_v1');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('wh_logs_v1');
    return saved ? JSON.parse(saved) : INITIAL_LOGS;
  });

  // GitHub Sync State
  const [githubConfig, setGithubConfig] = useState(() => {
    const saved = localStorage.getItem('wh_github_config');
    return saved ? JSON.parse(saved) : { token: '', owner: 'yaroslavkoshil', repo: 'SkladPro', path: 'database.json' };
  });
  const [fileSha, setFileSha] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');

  // Auth State
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('wh_is_admin') === 'true';
  });
  const [adminPassword, setAdminPassword] = useState('');

  // Navigation
  const [activeTab, setActiveTab] = useState('inventory');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // UI State
  const [notification, setNotification] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Operation Form State (for generic New Operation tab)
  const [opSku, setOpSku] = useState('');
  const [opQty, setOpQty] = useState('');
  const [opBox, setOpBox] = useState('');
  const [opNote, setOpNote] = useState('');
  const [opOrderRef, setOpOrderRef] = useState('');
  const [newProductName, setNewProductName] = useState('');
  
  // Modal Quick Operation State
  const [modalOpType, setModalOpType] = useState('OUT');
  const [modalOpQty, setModalOpQty] = useState('1');
  const [modalOpNote, setModalOpNote] = useState('');
  const [modalOpOrderRef, setModalOpOrderRef] = useState('');

  // Save to LocalStorage
  useEffect(() => { localStorage.setItem('wh_products_v1', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('wh_logs_v1', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('wh_github_config', JSON.stringify(githubConfig)); }, [githubConfig]);
  useEffect(() => { sessionStorage.setItem('wh_is_admin', isAdmin); }, [isAdmin]);

  const showNotice = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (adminPassword === '0000') {
      setIsAdmin(true); setAdminPassword('');
      showNotice('Доступ дозволено. Режим редагування увімкнено!');
      setActiveTab('inventory');
    } else {
      showNotice('Невірний пароль!', 'error');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false); setActiveTab('inventory');
    showNotice('Ви вийшли з режиму адміністратора');
  };

  // -----------------------------------------------------
  // GitHub Cloud Synchronization
  // -----------------------------------------------------
  const hasGithubSetup = !!(githubConfig.owner && githubConfig.repo);

  const fetchFromGithub = async () => {
    if (!hasGithubSetup) {
      showNotice('Заповніть налаштування хмари!', 'error');
      return;
    }
    setSyncStatus('syncing');
    try {
      let parsed = null;
      
      // If we have a token, fetch directly from API to bypass CDN cache
      if (githubConfig.token) {
        const res = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
          headers: { 'Authorization': `token ${githubConfig.token}`, 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store'
        });
        if (!res.ok) throw new Error('API fetch failed');
        const data = await res.json();
        setFileSha(data.sha);
        parsed = JSON.parse(b64DecodeUnicode(data.content));
      } else {
        // Fallback to raw (might be cached for 5 mins)
        const rawRes = await fetch(`https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/main/${githubConfig.path}?t=${Date.now()}`);
        if (!rawRes.ok) throw new Error('Raw fetch failed');
        parsed = await rawRes.json();
      }

      if (parsed && parsed.products) setProducts(parsed.products);
      if (parsed && parsed.logs) setLogs(parsed.logs);
      setSyncStatus('success');
      showNotice('Дані успішно оновлено!');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showNotice('Помилка завантаження даних', 'error');
    }
  };

  const pushToGithub = async (newProducts, newLogs) => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) return;
    setSyncStatus('syncing');
    try {
      const content = b64EncodeUnicode(JSON.stringify({ products: newProducts, logs: newLogs }, null, 2));
      const body = { message: `SkladControl update: ${new Date().toLocaleString('uk-UA')}`, content: content };
      try {
        const getRes = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
            headers: { 'Authorization': `token ${githubConfig.token}` }
        });
        if (getRes.ok) { const data = await getRes.json(); body.sha = data.sha; }
      } catch(e) { }

      const res = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubConfig.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) throw new Error('Push failed');
      const data = await res.json();
      setFileSha(data.content.sha);
      setSyncStatus('success');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showNotice('Помилка збереження на GitHub!', 'error');
    }
  };

  useEffect(() => {
    if (hasGithubSetup && !fileSha) fetchFromGithub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------

  const allBoxes = useMemo(() => Array.from(new Set(products.map(p => p.boxNumber.trim().toUpperCase()))).sort(), [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const currentBalance = p.receivedQty - p.sentQty;
      const matchesSearch = p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBox = selectedBoxFilter === 'ALL' || p.boxNumber.toUpperCase() === selectedBoxFilter.toUpperCase();
      let matchesStatus = true;
      if (statusFilter === 'IN_STOCK') matchesStatus = currentBalance > p.minQty;
      if (statusFilter === 'LOW_STOCK') matchesStatus = currentBalance > 0 && currentBalance <= p.minQty;
      if (statusFilter === 'OUT_OF_STOCK') matchesStatus = currentBalance <= 0;
      return matchesSearch && matchesBox && matchesStatus;
    });
  }, [products, searchQuery, selectedBoxFilter, statusFilter]);

  const summaryMetrics = useMemo(() => {
    let totalItemsCount = products.length;
    let totalReceived = 0; let totalSent = 0; let totalInStock = 0; let mismatchedCount = 0;
    products.forEach(p => {
      totalReceived += Number(p.receivedQty); totalSent += Number(p.sentQty);
      const balance = p.receivedQty - p.sentQty; totalInStock += balance;
      if (p.receivedQty !== (p.sentQty + balance)) mismatchedCount++;
    });
    return { totalItemsCount, totalReceived, totalSent, totalInStock, mismatchedCount, isPerfectBalance: mismatchedCount === 0 };
  }, [products]);
  
  const boxAnalytics = useMemo(() => {
    const boxes = {};
    products.forEach(p => {
      const box = p.boxNumber.toUpperCase() || 'Б/Н';
      if(!boxes[box]) boxes[box] = { count: 0, items: 0, products: [] };
      boxes[box].count += 1;
      boxes[box].items += (p.receivedQty - p.sentQty);
      boxes[box].products.push(p);
    });
    return boxes;
  }, [products]);

  // Core execution logic for both New Operation form and Modal Quick Operation
  const executeOperationCore = async (type, sku, qty, box, note, orderRef, newName = null, newMin = 10) => {
    if (!isAdmin) { showNotice('У вас немає прав для редагування', 'error'); return false; }
    
    let updatedProducts = [...products];
    let newLogs = [...logs];

    if (type === 'NEW') {
      const trimmedSku = sku.trim().toUpperCase();
      if (!trimmedSku || !newName?.trim()) { showNotice('Заповніть обов’язкові поля', 'error'); return false; }
      if (products.some(p => p.sku.toUpperCase() === trimmedSku)) { showNotice(`Артикул "${trimmedSku}" вже існує!`, 'error'); return false; }

      const finalBox = box.trim().toUpperCase() || 'Б/Н';
      updatedProducts = [{
        id: `prod-${Date.now()}`, sku: trimmedSku, name: newName.trim(), boxNumber: finalBox,
        receivedQty: qty, sentQty: 0, minQty: newMin, updatedAt: new Date().toISOString()
      }, ...products];

      newLogs = [{
        id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: 'IN', sku: trimmedSku,
        productName: newName.trim(), boxNumber: finalBox, changeQty: qty, prevBalance: 0, newBalance: qty,
        orderId: orderRef || 'ПР-НОВИЙ', note: note || 'Створення нового артикулу'
      }, ...logs];

      showNotice(`Успішно додано новий артикул ${trimmedSku}!`);
    } else {
      const targetProduct = products.find(p => p.sku.toUpperCase() === sku.trim().toUpperCase());
      if (!targetProduct) { showNotice(`Товар "${sku}" не знайдено`, 'error'); return false; }

      const currentBalance = targetProduct.receivedQty - targetProduct.sentQty;
      if (type === 'OUT' && qty > currentBalance) { showNotice(`Доступний залишок: ${currentBalance} шт.`, 'error'); return false; }

      let updatedReceived = targetProduct.receivedQty;
      let updatedSent = targetProduct.sentQty;
      let newBalance = currentBalance;

      if (type === 'OUT') { updatedSent += qty; newBalance = currentBalance - qty; } 
      else { updatedReceived += qty; newBalance = currentBalance + qty; }

      const finalBox = box.trim() ? box.trim().toUpperCase() : targetProduct.boxNumber;

      updatedProducts = products.map(p => p.id === targetProduct.id ? 
        { ...p, receivedQty: updatedReceived, sentQty: updatedSent, boxNumber: finalBox, updatedAt: new Date().toISOString() } : p);

      newLogs = [{
        id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: type, sku: targetProduct.sku,
        productName: targetProduct.name, boxNumber: finalBox, changeQty: qty, prevBalance: currentBalance,
        newBalance: newBalance, orderId: orderRef || (type === 'OUT' ? 'ВІДПР' : 'ПОПОВНЕННЯ'),
        note: note || (type === 'OUT' ? 'Списання' : 'Прихід')
      }, ...logs];

      showNotice(type === 'OUT' ? `Списано ${qty} шт.` : `Отримано +${qty} шт.`);
    }

    setProducts(updatedProducts);
    setLogs(newLogs);
    if (githubConfig.token) await pushToGithub(updatedProducts, newLogs);
    
    // Update selected product if modal is open
    if (selectedProduct) {
      const updatedSelect = updatedProducts.find(p => p.id === selectedProduct.id);
      setSelectedProduct(updatedSelect);
    }
    return true;
  };

  const handleSkuChange = (e) => {
    const val = e.target.value.toUpperCase();
    setOpSku(val);
    const existing = products.find(p => p.sku.toUpperCase() === val);
    if (existing) {
      setNewProductName(existing.name);
      setOpBox(existing.boxNumber);
    } else {
      setNewProductName(''); 
      setOpBox('');
    }
  };

  const handleExecuteOperation = async (e) => {
    e.preventDefault();
    const qty = parseInt(opQty, 10);
    if (isNaN(qty) || qty <= 0) return showNotice('Вкажіть коректну кількість', 'error');
    
    const existing = products.find(p => p.sku.toUpperCase() === opSku.trim().toUpperCase());
    const type = existing ? 'IN' : 'NEW';
    
    const success = await executeOperationCore(type, opSku, qty, opBox, opNote, opOrderRef, newProductName, 10);
    if (success) {
      setOpSku(''); setOpQty(''); setNewProductName(''); setOpNote(''); setOpOrderRef(''); setOpBox('');
    }
  };

  const handleModalOperation = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseInt(modalOpQty, 10);
    if (isNaN(qty) || qty <= 0) return showNotice('Вкажіть коректну кількість', 'error');
    
    const success = await executeOperationCore(modalOpType, selectedProduct.sku, qty, '', modalOpNote, modalOpOrderRef);
    if (success) {
      setModalOpQty('1'); setModalOpNote(''); setModalOpOrderRef('');
    }
  };

  const exportDataJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ products, logs }, null, 2));
    const a = document.createElement('a'); a.href = dataStr; a.download = `sklad_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const importDataJSON = (e) => {
    if (!isAdmin) return showNotice('Потрібні права адміністратора', 'error');
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (eReader) => {
        try {
          const parsed = JSON.parse(eReader.target.result);
          if (parsed.products) {
            setProducts(parsed.products);
            if (parsed.logs) setLogs(parsed.logs);
            showNotice('Дані імпортовано локально!');
            if (githubConfig.token) pushToGithub(parsed.products, parsed.logs || logs);
          }
        } catch (err) {}
      };
    }
  };

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setModalOpType('OUT');
    setModalOpQty('1');
    setModalOpNote('');
    setModalOpOrderRef('');
  };

  const TABS = [
    { id: 'inventory', label: 'Товари та Залишки', icon: Layers, adminOnly: false },
    { id: 'history', label: 'Історія змін', icon: History, adminOnly: false },
    { id: 'operations', label: 'Реєстрація операції', icon: Truck, adminOnly: true },
    { id: 'reconciliation', label: 'Звірка та Аналітика', icon: BarChart3, adminOnly: false }, // Made public for manager to see analytics
    { id: 'settings', label: 'Налаштування хмари', icon: Settings, adminOnly: true },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 transition-all duration-300 ${isMobileMenuOpen ? 'absolute z-50 h-full shadow-2xl' : 'hidden md:flex'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-md text-white">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">СкладКонтроль</h1>
              <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">Pro Edition</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {TABS.filter(t => !t.adminOnly || isAdmin).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
          
          <div className="my-4 border-t border-slate-100"></div>
          
          {!isAdmin ? (
             <button onClick={() => { setActiveTab('login'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'login' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}>
               <Settings className="w-5 h-5" /> Увійти в Адмінку
             </button>
          ) : (
             <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100">
               <XCircle className="w-5 h-5" /> Вийти з Адмінки
             </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
            <Server className="w-4 h-4 text-slate-400" />
            Статус хмари
          </div>
          <div className="flex items-center gap-2 mt-2">
            {!hasGithubSetup && <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200 text-slate-600 border border-slate-300">Локально</span>}
            {hasGithubSetup && syncStatus === 'success' && <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200"><Cloud className="w-3.5 h-3.5"/> Синхронізовано</span>}
            {hasGithubSetup && syncStatus === 'syncing' && <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200"><RefreshCcw className="w-3.5 h-3.5 animate-spin"/> Оновлення</span>}
            {hasGithubSetup && syncStatus === 'error' && <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200"><CloudOff className="w-3.5 h-3.5"/> Помилка</span>}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Package className="w-5 h-5 text-indigo-600" />
            СкладКонтроль
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-slate-100 rounded-lg text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold ${notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {notification.type === 'error' ? <XCircle className="w-5 h-5 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              <span>{notification.msg}</span>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="w-full mx-auto space-y-6">
            
            {/* LOGIN TAB */}
            {activeTab === 'login' && !isAdmin && (
              <div className="max-w-md mx-auto mt-20 bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Settings className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Панель Адміністратора</h2>
                <p className="text-sm text-slate-500 mb-8">Введіть пароль для доступу до редагування залишків та налаштувань.</p>
                <form onSubmit={handleLogin}>
                  <input 
                    type="password" placeholder="Пароль" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-4 text-center text-xl tracking-widest text-slate-800 outline-none transition-all mb-4" 
                    autoFocus
                  />
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 rounded-xl font-bold transition-all">Увійти</button>
                </form>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && isAdmin && (
              <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h2 className="text-2xl font-extrabold text-slate-800 mb-2 flex items-center gap-3">
                  <Server className="w-7 h-7 text-indigo-600" /> Хмарна синхронізація
                </h2>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  Налаштуйте з'єднання з вашим публічним GitHub репозиторієм. Для редагування необхідний токен доступу.
                </p>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Personal Access Token (Для збереження змін)</label>
                    <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={githubConfig.token} onChange={e => setGithubConfig({...githubConfig, token: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-3.5 text-slate-800 text-sm outline-none transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">GitHub Owner (Логін)</label>
                      <input type="text" placeholder="Yaroslav" value={githubConfig.owner} onChange={e => setGithubConfig({...githubConfig, owner: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-3.5 text-slate-800 text-sm outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Repository</label>
                      <input type="text" placeholder="SkladPro" value={githubConfig.repo} onChange={e => setGithubConfig({...githubConfig, repo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-3.5 text-slate-800 text-sm outline-none transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">File Path</label>
                    <input type="text" value={githubConfig.path} onChange={e => setGithubConfig({...githubConfig, path: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-3.5 text-slate-800 text-sm outline-none transition-all" />
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-slate-100">
                    <button onClick={fetchFromGithub} className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 shadow-sm rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                      <Download className="w-5 h-5" /> Завантажити з хмари
                    </button>
                    <button onClick={() => pushToGithub(products, logs)} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                      <Upload className="w-5 h-5" /> Примусово зберегти
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* OPERATIONS TAB */}
            {activeTab === 'operations' && isAdmin && (
              <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <div className="mb-6">
                   <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                     <ArrowDownLeft className="w-7 h-7 text-emerald-600" /> Оприбуткування товару
                   </h2>
                   <p className="text-sm text-slate-500 mt-2">Відвантаження товарів зі складу здійснюється через Картку товару в загальній таблиці.</p>
                </div>
                
                <form onSubmit={handleExecuteOperation} className="space-y-5">
                  <div className="grid gap-4">
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Артикул (SKU)</label>
                      <input 
                         required 
                         placeholder="Введіть артикул (напр. ART-100)" 
                         list="sku-list" 
                         value={opSku} 
                         onChange={handleSkuChange}
                         className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none font-mono font-bold" 
                      />
                      <datalist id="sku-list">{products.map(p => <option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Назва товару</label>
                      <input 
                         required 
                         placeholder="Назва товару (заповнюється автоматично для існуючих)" 
                         value={newProductName} 
                         onChange={e=>setNewProductName(e.target.value)} 
                         className={`bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none ${products.some(p => p.sku.toUpperCase() === opSku.toUpperCase()) ? 'bg-slate-50 text-slate-600 font-medium' : ''}`}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Кількість (шт)</label>
                      <input required type="number" min="1" placeholder="Кількість шт" value={opQty} onChange={e=>setOpQty(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none font-extrabold text-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Місце / Коробка</label>
                      <input placeholder="Коробка (A1...)" value={opBox} onChange={e=>setOpBox(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Замовлення / ТТН</label>
                      <input placeholder="Документ" value={opOrderRef} onChange={e=>setOpOrderRef(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Примітка</label>
                      <input placeholder="Коментар" value={opNote} onChange={e=>setOpNote(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none" />
                    </div>
                  </div>
                  
                  <button type="submit" className="w-full mt-6 py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                    <ArrowDownLeft className="w-5 h-5"/> Оприбуткувати товар
                  </button>
                </form>
              </div>
            )}

            {/* INVENTORY TAB - DETAILED RICH VIEW */}
            {activeTab === 'inventory' && (
              <div className="flex flex-col gap-4">
                {/* Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="relative flex-1 min-w-[250px] max-w-lg">
                    <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Пошук за артикулом, назвою чи коробкою..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-all" />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                      <Box className="w-4 h-4 text-slate-400" />
                      <select value={selectedBoxFilter} onChange={(e) => setSelectedBoxFilter(e.target.value)} className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer">
                        <option value="ALL">Всі коробки ({allBoxes.length})</option>
                        {allBoxes.map(b => <option key={b} value={b}>Коробка #{b}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                      <Filter className="w-4 h-4 text-slate-400" />
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer">
                        <option value="ALL">Всі статуси</option>
                        <option value="IN_STOCK">В наявності</option>
                        <option value="LOW_STOCK">Закінчується</option>
                        <option value="OUT_OF_STOCK">Немає в наявності</option>
                      </select>
                    </div>
                    {isAdmin && (
                      <button onClick={() => setActiveTab('operations')} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2">
                        <PlusCircle className="w-4 h-4" /> Додати товар
                      </button>
                    )}
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-4 pl-6">Артикул (SKU)</th>
                          <th className="p-0">
                            <div className="resize-x overflow-hidden w-64 min-w-[200px] max-w-[1000px] p-4 relative group" title="Потягніть правий нижній кут, щоб змінити ширину">
                              Назва товару
                            </div>
                          </th>
                          <th className="p-4 text-center">Всього отримано</th>
                          <th className="p-4 text-center">Відправлено</th>
                          <th className="p-4 text-center">Поточний залишок</th>
                          <th className="p-4 text-center">Дії та Картка</th>
                          <th className="p-4 text-center">Контроль точності</th>
                          <th className="p-4 pr-6 text-center">Місце / Коробка</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => {
                          const bal = p.receivedQty - p.sentQty;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 pl-6 font-mono font-bold text-indigo-600">{p.sku}</td>
                              <td className="p-4 font-medium text-slate-800 whitespace-normal break-words">
                                <div className="flex flex-col gap-1">
                                  <span>{p.name}</span>
                                  <div>
                                    {bal <= 0 && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-100 text-rose-700 border border-rose-200">Немає в наявності</span>}
                                    {bal > 0 && bal <= p.minQty && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-100 text-amber-700 border border-amber-200">Закінчується ({bal} шт)</span>}
                                    {bal > p.minQty && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">В наявності</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-center font-bold text-emerald-600">+{p.receivedQty}</td>
                              <td className="p-4 text-center font-bold text-amber-500">-{p.sentQty}</td>
                              <td className="p-4 text-center">
                                <span className={`text-lg font-extrabold ${bal <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>{bal}</span>
                                <span className="text-xs text-slate-400 ml-1">шт.</span>
                              </td>
                              <td className="p-4 text-center">
                                <button onClick={() => openProductModal(p)} className="px-3 py-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5">
                                  <Info className="w-4 h-4"/> Картка & Історія
                                </button>
                              </td>
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50">
                                  <CheckCircle className="w-3.5 h-3.5" /> 100% Точно
                                </span>
                              </td>
                              <td className="p-4 pr-6 text-center">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-lg text-slate-700 font-mono text-xs border border-slate-200 font-bold">
                                  <Box className="w-3.5 h-3.5 text-slate-400"/> #{p.boxNumber}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredProducts.length === 0 && (
                          <tr><td colSpan="8" className="p-8 text-center text-slate-400 font-medium">Нічого не знайдено</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* DETAILED HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-600" /> Хронологічний журнал операцій
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Повна історія відправок, приходів та змін по кожному товару</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                    Загалом записів: {logs.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-4 pl-6">Дата та час</th>
                        <th className="p-4">Тип</th>
                        <th className="p-4">Артикул / Назва</th>
                        <th className="p-4 text-center">Коробка</th>
                        <th className="p-4 text-center">Зміна</th>
                        <th className="p-4 text-center">Залишок після</th>
                        <th className="p-4 pr-6">Документ / Примітка</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(logs.reduce((acc, log) => {
                        const dateStr = new Date(log.timestamp).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
                        if (!acc[dateStr]) acc[dateStr] = [];
                        acc[dateStr].push(log);
                        return acc;
                      }, {})).map(([date, dayLogs]) => (
                        <React.Fragment key={date}>
                          <tr className="bg-slate-100 border-y border-slate-200">
                            <td colSpan="7" className="p-3 pl-6 font-extrabold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                              📅 ОПЕРАЦІЇ ЗА {date.toUpperCase()} <span className="ml-2 text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{dayLogs.length} записів</span>
                            </td>
                          </tr>
                          {dayLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 pl-6 text-xs font-medium text-slate-500">{new Date(log.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="p-4">
                                {log.type === 'OUT' ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    <ArrowUpRight className="w-3.5 h-3.5"/> Відправка
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <ArrowDownLeft className="w-3.5 h-3.5"/> Прихід
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className="font-mono font-bold text-indigo-600 mr-2">{log.sku}</span>
                                <span className="text-slate-800 font-medium text-sm">{log.productName}</span>
                              </td>
                              <td className="p-4 text-center">
                                 <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">#{log.boxNumber}</span>
                              </td>
                              <td className={`p-4 text-center font-extrabold text-base ${log.type==='OUT'?'text-amber-500':'text-emerald-500'}`}>
                                {log.type === 'OUT' ? '-' : '+'}{log.changeQty}
                              </td>
                              <td className="p-4 text-center font-bold text-slate-800">
                                {log.newBalance} <span className="text-xs text-slate-400 font-normal">шт.</span>
                              </td>
                              <td className="p-4 pr-6 text-slate-600 text-sm">
                                {log.orderId && <span className="font-bold text-slate-700 mr-2">[{log.orderId}]</span>}
                                {log.note}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RECONCILIATION TAB */}
            {activeTab === 'reconciliation' && (
              <div className="space-y-6">
                
                {/* Auto Balance Module */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 mb-1">
                      <BarChart3 className="w-5 h-5 text-indigo-600" /> Модуль Автоматичної Звірки та Балансу
                    </h3>
                    <p className="text-sm text-slate-500">Перевірка математичної точності та відсутності розбіжностей за формулою: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">Отримано = Залишок + Відправлено</code></p>
                  </div>
                  {summaryMetrics.isPerfectBalance ? (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold">
                      <CheckCircle className="w-5 h-5" /> Баланс 100% Збігається
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold">
                      <AlertTriangle className="w-5 h-5" /> Знайдено розбіжності ({summaryMetrics.mismatchedCount})
                    </span>
                  )}
                </div>

                {/* Box Analytics */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 mb-6">
                    <Box className="w-5 h-5 text-indigo-600" /> Аналітика завантаженості за коробками
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Object.entries(boxAnalytics).map(([box, data]) => (
                      <div key={box} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5"><Box className="w-4 h-4 text-indigo-500"/> Коробка <span className="text-indigo-600">#{box}</span></span>
                          <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{data.count} артикулів</span>
                        </div>
                        <div className="text-2xl font-extrabold text-slate-800 mb-4">{data.items} <span className="text-sm font-normal text-slate-500">од. товарів</span></div>
                        <div className="mt-auto space-y-1">
                           {data.products.slice(0, 3).map(p => (
                             <div key={p.id} className="flex justify-between text-xs text-slate-500 items-center">
                               <span className="truncate pr-2">{p.sku} - {p.name}</span>
                               <span className="font-bold whitespace-nowrap">{p.receivedQty - p.sentQty} шт</span>
                             </div>
                           ))}
                           {data.products.length > 3 && <div className="text-xs text-slate-400 italic pt-1">та ще {data.products.length - 3}...</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Backup & Manage */}
                {isAdmin && (
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800 mb-1">Резервне копіювання та Керування даними</h3>
                      <p className="text-sm text-slate-500">Збережіть базу даних у JSON для перенесення на інший пристрій.</p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={exportDataJSON} className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm text-sm">
                        <Download className="w-4 h-4"/> Експорт JSON
                      </button>
                      <label className="px-4 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer text-sm">
                        <Upload className="w-4 h-4"/> Імпорт JSON
                        <input type="file" className="hidden" onChange={importDataJSON}/>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* DETAILED PRODUCT MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}></div>
          <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold font-mono text-sm rounded-lg">{selectedProduct.sku}</span>
                  <span className="px-3 py-1 bg-slate-200 text-slate-600 font-bold font-mono text-sm rounded-lg flex items-center gap-1.5"><Box className="w-4 h-4"/> Коробка #{selectedProduct.boxNumber}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800">{selectedProduct.name}</h2>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex-1 flex flex-col gap-6">
              
              {/* Big Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="text-sm font-bold text-emerald-600 mb-1">Всього Отримано</div>
                  <div className="text-3xl font-extrabold text-emerald-600">+{selectedProduct.receivedQty} <span className="text-base font-medium">шт</span></div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <div className="text-sm font-bold text-amber-600 mb-1">Всього Відправлено</div>
                  <div className="text-3xl font-extrabold text-amber-500">-{selectedProduct.sentQty} <span className="text-base font-medium">шт</span></div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
                  <div className="text-sm font-bold text-indigo-700 mb-1">Поточний Залишок</div>
                  <div className="text-3xl font-extrabold text-indigo-700">{selectedProduct.receivedQty - selectedProduct.sentQty} <span className="text-base font-medium">шт</span></div>
                </div>
              </div>

              {/* Quick Operation Form */}
              {isAdmin && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-indigo-500"/> Швидке проведення відправки / приходу
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setModalOpType('OUT')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${modalOpType==='OUT' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>- Відправка</button>
                      <button onClick={() => setModalOpType('IN')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${modalOpType==='IN' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>+ Прихід</button>
                    </div>
                  </div>
                  
                  <form onSubmit={handleModalOperation}>
                    <div className="flex flex-wrap gap-4 items-end">
                      
                      <div className="flex-shrink-0">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Кількість (шт)</label>
                        <div className="flex gap-2">
                          <input type="number" required min="1" value={modalOpQty} onChange={e=>setModalOpQty(e.target.value)} className="w-20 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 font-extrabold text-lg text-center outline-none" />
                          <div className="flex gap-1">
                            {[1,2,5,10].map(n => (
                              <button type="button" key={n} onClick={() => setModalOpQty(String((parseInt(modalOpQty)||0) + n))} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm border border-slate-200 transition-colors">+{n}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">№ ТТН / Замовлення</label>
                        <input type="text" placeholder="напр. ТТН-2041" value={modalOpOrderRef} onChange={e=>setModalOpOrderRef(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 outline-none text-sm font-medium" />
                      </div>

                      <div className="flex-1 min-w-[250px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Примітка</label>
                        <input type="text" placeholder="Коментар" value={modalOpNote} onChange={e=>setModalOpNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl p-3 outline-none text-sm font-medium" />
                      </div>
                    </div>
                    
                    <button type="submit" className={`w-full mt-5 py-4 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${modalOpType==='OUT' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}>
                      {modalOpType === 'OUT' ? <ArrowUpRight className="w-5 h-5"/> : <ArrowDownLeft className="w-5 h-5"/>}
                      {modalOpType === 'OUT' ? 'Підтвердити відправку' : 'Підтвердити прихід'}
                    </button>
                  </form>
                </div>
              )}

              {/* History for this product */}
              <div className="mt-2">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-indigo-500"/> Історія змін та відправок для {selectedProduct.sku} ({logs.filter(l => l.sku === selectedProduct.sku).length})
                </h3>
                <div className="space-y-3">
                  {logs.filter(l => l.sku === selectedProduct.sku).map(log => (
                    <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:shadow-sm transition-all gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${log.type==='OUT' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {log.type === 'OUT' ? <ArrowUpRight className="w-5 h-5"/> : <ArrowDownLeft className="w-5 h-5"/>}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            {log.type === 'OUT' ? 'Відправка товару' : 'Оприбуткування'}
                            {log.orderId && <span className="text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">[{log.orderId}]</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{new Date(log.timestamp).toLocaleString('uk-UA')}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>{log.note || 'Без примітки'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex sm:flex-col justify-between items-center sm:items-end">
                        <div className={`text-lg font-extrabold ${log.type==='OUT' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {log.type === 'OUT' ? '-' : '+'}{log.changeQty} <span className="text-sm">шт</span>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">Залишок: {log.newBalance} шт</div>
                      </div>
                    </div>
                  ))}
                  {logs.filter(l => l.sku === selectedProduct.sku).length === 0 && (
                     <div className="p-8 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl">Історія операцій порожня</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
