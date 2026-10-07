import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Truck, History, CheckCircle2, AlertTriangle, XCircle, Search, 
  PlusCircle, MinusCircle, Box, Download, Upload, RefreshCw, BarChart3, 
  Layers, ArrowDownLeft, ArrowUpRight, Filter, CheckCircle,
  Cloud, CloudOff, Settings, Save, Server, RefreshCcw, Menu
} from 'lucide-react';

const INITIAL_PRODUCTS = [
  {
    id: 'prod-1', sku: 'ART-1001', name: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    receivedQty: 150, sentQty: 45, minQty: 10, updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }
];

const INITIAL_LOGS = [
  {
    id: 'log-1', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), type: 'IN',
    sku: 'ART-1001', productName: 'Бездротові навушники AirSound Pro', boxNumber: 'A1',
    changeQty: 150, prevBalance: 0, newBalance: 150, orderId: 'SUP-8841', note: 'Початковий прихід'
  }
];

// Helper functions for safe base64 encoding (supports UTF-8 / Cyrillic)
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
    // Pre-fill owner and repo for the public read
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [notification, setNotification] = useState(null);

  // Operation Form State
  const [opType, setOpType] = useState('OUT');
  const [opSku, setOpSku] = useState('');
  const [opQty, setOpQty] = useState('');
  const [opBox, setOpBox] = useState('');
  const [opNote, setOpNote] = useState('');
  const [opOrderRef, setOpOrderRef] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newMinQty, setNewMinQty] = useState('10');

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
      setIsAdmin(true);
      setAdminPassword('');
      showNotice('Доступ дозволено. Режим редагування увімкнено!');
      setActiveTab('operations');
    } else {
      showNotice('Невірний пароль!', 'error');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setActiveTab('inventory');
    showNotice('Ви вийшли з режиму адміністратора');
  };

  // -----------------------------------------------------
  // GitHub Cloud Synchronization Logic
  // -----------------------------------------------------
  const hasGithubSetup = !!(githubConfig.owner && githubConfig.repo);

  const fetchFromGithub = async () => {
    if (!hasGithubSetup) return;
    setSyncStatus('syncing');
    try {
      // First try to fetch from raw github content (works if repo is public, without token)
      const rawRes = await fetch(`https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/main/${githubConfig.path}?t=${Date.now()}`);
      
      if (rawRes.ok) {
        const parsed = await rawRes.json();
        if (parsed.products) setProducts(parsed.products);
        if (parsed.logs) setLogs(parsed.logs);
        setSyncStatus('success');
        showNotice('Дані успішно завантажено!');
        
        // Try to fetch SHA silently in background for future pushes (requires token)
        if (githubConfig.token) {
           fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
              headers: { 'Authorization': `token ${githubConfig.token}`, 'Accept': 'application/vnd.github.v3+json' }
           }).then(r => r.json()).then(d => { if(d.sha) setFileSha(d.sha); }).catch(()=>{});
        }
        return;
      }

      // Fallback to API if private (requires token)
      if (!githubConfig.token) throw new Error('Для приватного репозиторію потрібен токен');

      const res = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
        headers: { 'Authorization': `token ${githubConfig.token}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (res.status === 404) {
        setSyncStatus('success');
        showNotice('Файл бази не знайдено на GitHub. Буде створено при збереженні.');
        return;
      }
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setFileSha(data.sha);
      const parsed = JSON.parse(b64DecodeUnicode(data.content));
      if (parsed.products) setProducts(parsed.products);
      if (parsed.logs) setLogs(parsed.logs);
      setSyncStatus('success');
      showNotice('Дані успішно завантажено з хмари GitHub!');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showNotice('Помилка завантаження. Можливо репозиторій приватний.', 'error');
    }
  };

  const pushToGithub = async (newProducts, newLogs) => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
       showNotice('Для збереження потрібен токен в налаштуваннях!', 'error');
       return;
    }
    setSyncStatus('syncing');
    try {
      const content = b64EncodeUnicode(JSON.stringify({ products: newProducts, logs: newLogs }, null, 2));
      const body = {
        message: `SkladControl update: ${new Date().toLocaleString('uk-UA')}`,
        content: content,
      };
      try {
        const getRes = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
            headers: { 'Authorization': `token ${githubConfig.token}` }
        });
        if (getRes.ok) {
            const data = await getRes.json();
            body.sha = data.sha;
        }
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
      showNotice('Зміни успішно збережено на GitHub!');
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

  const handleExecuteOperation = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showNotice('У вас немає прав для редагування', 'error');

    const qty = parseInt(opQty, 10);
    if (isNaN(qty) || qty <= 0) return showNotice('Вкажіть коректну кількість', 'error');

    let updatedProducts = [...products];
    let newLogs = [...logs];

    if (opType === 'NEW') {
      const trimmedSku = opSku.trim().toUpperCase();
      if (!trimmedSku || !newProductName.trim()) return showNotice('Заповніть обов’язкові поля', 'error');
      if (products.some(p => p.sku.toUpperCase() === trimmedSku)) return showNotice(`Артикул "${trimmedSku}" вже існує!`, 'error');

      const box = opBox.trim().toUpperCase() || 'Б/Н';
      updatedProducts = [{
        id: `prod-${Date.now()}`, sku: trimmedSku, name: newProductName.trim(), boxNumber: box,
        receivedQty: qty, sentQty: 0, minQty: parseInt(newMinQty, 10) || 5, updatedAt: new Date().toISOString()
      }, ...products];

      newLogs = [{
        id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: 'IN', sku: trimmedSku,
        productName: newProductName.trim(), boxNumber: box, changeQty: qty, prevBalance: 0, newBalance: qty,
        orderId: opOrderRef || 'ПР-НОВИЙ', note: opNote || 'Створення нового артикулу'
      }, ...logs];

      setOpSku(''); setOpQty(''); setNewProductName(''); setOpNote(''); setOpOrderRef('');
      showNotice(`Успішно додано новий артикул ${trimmedSku}!`);
    } else {
      const targetProduct = products.find(p => p.sku.toUpperCase() === opSku.trim().toUpperCase());
      if (!targetProduct) return showNotice(`Товар "${opSku}" не знайдено`, 'error');

      const currentBalance = targetProduct.receivedQty - targetProduct.sentQty;
      if (opType === 'OUT' && qty > currentBalance) return showNotice(`Доступний залишок: ${currentBalance} шт.`, 'error');

      let updatedReceived = targetProduct.receivedQty;
      let updatedSent = targetProduct.sentQty;
      let newBalance = currentBalance;

      if (opType === 'OUT') { updatedSent += qty; newBalance = currentBalance - qty; } 
      else { updatedReceived += qty; newBalance = currentBalance + qty; }

      const finalBox = opBox.trim() ? opBox.trim().toUpperCase() : targetProduct.boxNumber;

      updatedProducts = products.map(p => p.id === targetProduct.id ? 
        { ...p, receivedQty: updatedReceived, sentQty: updatedSent, boxNumber: finalBox, updatedAt: new Date().toISOString() } : p);

      newLogs = [{
        id: `log-${Date.now()}`, timestamp: new Date().toISOString(), type: opType, sku: targetProduct.sku,
        productName: targetProduct.name, boxNumber: finalBox, changeQty: qty, prevBalance: currentBalance,
        newBalance: newBalance, orderId: opOrderRef || (opType === 'OUT' ? 'ВІДПР' : 'ПОПОВНЕННЯ'),
        note: opNote || (opType === 'OUT' ? 'Списання' : 'Прихід')
      }, ...logs];

      showNotice(opType === 'OUT' ? `Списано ${qty} шт.` : `Отримано +${qty} шт.`);
      setOpQty(''); setOpNote(''); setOpOrderRef('');
    }

    setProducts(updatedProducts);
    setLogs(newLogs);
    if (githubConfig.token) await pushToGithub(updatedProducts, newLogs);
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

  const TABS = [
    { id: 'inventory', label: 'Товари та Залишки', icon: Layers, adminOnly: false },
    { id: 'history', label: 'Історія змін', icon: History, adminOnly: false },
    { id: 'operations', label: 'Провести операцію', icon: Truck, adminOnly: true },
    { id: 'reconciliation', label: 'Звірка та Експорт', icon: BarChart3, adminOnly: true },
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
          {/* Mobile close button */}
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
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
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

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Global Metrics Header (Rendered on most tabs) */}
            {activeTab !== 'settings' && activeTab !== 'operations' && activeTab !== 'login' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-100 rounded-lg"><Package className="w-4 h-4 text-slate-600" /></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Позицій</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-800">{summaryMetrics.totalItemsCount}</div>
                </div>
                
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 rounded-lg"><ArrowDownLeft className="w-4 h-4 text-emerald-600" /></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Отримано</span>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-600">{summaryMetrics.totalReceived}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-50 rounded-lg"><ArrowUpRight className="w-4 h-4 text-amber-600" /></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Відправлено</span>
                  </div>
                  <div className="text-3xl font-extrabold text-amber-500">{summaryMetrics.totalSent}</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 rounded-lg"><Box className="w-4 h-4 text-indigo-600" /></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Залишок</span>
                  </div>
                  <div className="text-3xl font-extrabold text-indigo-600">{summaryMetrics.totalInStock}</div>
                </div>
              </div>
            )}
            
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
                    type="password" 
                    placeholder="Пароль" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl p-4 text-center text-xl tracking-widest text-slate-800 outline-none transition-all mb-4" 
                    autoFocus
                  />
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 rounded-xl font-bold transition-all">
                    Увійти
                  </button>
                </form>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && isAdmin && (
              <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h2 className="text-2xl font-extrabold text-slate-800 mb-2 flex items-center gap-3">
                  <Server className="w-7 h-7 text-indigo-600" />
                  Хмарна синхронізація
                </h2>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  Налаштуйте з'єднання з вашим приватним GitHub репозиторієм. Всі зміни залишків будуть автоматично зберігатися. Це забезпечить надійне збереження даних і можливість працювати з різних пристроїв.
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
                <h2 className="text-2xl font-extrabold text-slate-800 mb-6 flex items-center gap-3">
                  <Truck className="w-7 h-7 text-indigo-600" />
                  Реєстрація операції
                </h2>
                <form onSubmit={handleExecuteOperation} className="space-y-5">
                  <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                      <button type="button" onClick={() => setOpType('OUT')} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${opType==='OUT'?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>Відправка</button>
                      <button type="button" onClick={() => setOpType('IN')} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${opType==='IN'?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>Прихід</button>
                      <button type="button" onClick={() => setOpType('NEW')} className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${opType==='NEW'?'bg-white text-slate-800 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>Новий товар</button>
                  </div>
                  
                  {opType === 'NEW' ? (
                    <div className="grid gap-4">
                      <input required placeholder="Артикул (напр. ART-100)" value={opSku} onChange={e=>setOpSku(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 w-full outline-none font-mono" />
                      <input required placeholder="Назва товару" value={newProductName} onChange={e=>setNewProductName(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 w-full outline-none" />
                    </div>
                  ) : (
                    <input required placeholder="Введіть артикул..." list="sku-list" value={opSku} onChange={e=>{setOpSku(e.target.value.toUpperCase()); const m = products.find(p=>p.sku===e.target.value.toUpperCase()); if(m) setOpBox(m.boxNumber);}} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 w-full outline-none font-mono" />
                  )}
                  <datalist id="sku-list">{products.map(p => <option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>

                  <div className="grid grid-cols-2 gap-4">
                    <input required type="number" placeholder="Кількість шт" value={opQty} onChange={e=>setOpQty(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold" />
                    <input placeholder="Коробка (A1, B2...)" value={opBox} onChange={e=>setOpBox(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Замовлення/Документ" value={opOrderRef} onChange={e=>setOpOrderRef(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" />
                    <input placeholder="Примітка" value={opNote} onChange={e=>setOpNote(e.target.value)} className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none" />
                  </div>
                  
                  <button type="submit" className={`w-full mt-4 py-4 rounded-xl font-bold text-white shadow-md transition-all ${opType==='OUT'?'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20':opType==='IN'?'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20':'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}>
                    Підтвердити операцію
                  </button>
                </form>
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Пошук артикулу чи назви..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all" />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer">
                      <option value="ALL">Всі статуси</option>
                      <option value="IN_STOCK">В наявності</option>
                      <option value="LOW_STOCK">Закінчується</option>
                      <option value="OUT_OF_STOCK">Немає в наявності</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <tr><th className="p-4">Артикул</th><th className="p-4 w-full">Назва</th><th className="p-4">Місце</th><th className="p-4 text-right">Залишок</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map(p => {
                          const bal = p.receivedQty - p.sentQty;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-4 font-mono font-bold text-indigo-600">{p.sku}</td>
                              <td className="p-4 font-medium text-slate-800">
                                {p.name}
                                {bal <= 0 && <span className="ml-3 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-100 text-rose-600">Немає</span>}
                                {bal > 0 && bal <= p.minQty && <span className="ml-3 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-100 text-amber-600">Закінчується</span>}
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-600 font-mono text-xs border border-slate-200">
                                  #{p.boxNumber}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className={`text-base font-extrabold ${bal <= 0 ? 'text-rose-500' : 'text-slate-800'}`}>{bal}</span>
                                <span className="text-xs text-slate-400 ml-1">шт</span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredProducts.length === 0 && (
                          <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Нічого не знайдено</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600" /> Журнал операцій
                  </h3>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    {logs.length} записів
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <tr><th className="p-4">Час</th><th className="p-4">Тип</th><th className="p-4">Товар</th><th className="p-4">Зміна</th><th className="p-4 text-right">Залишок</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 text-xs font-medium text-slate-400">{new Date(log.timestamp).toLocaleString('uk-UA')}</td>
                          <td className="p-4">
                            {log.type === 'OUT' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold px-2 py-1 rounded bg-amber-100 text-amber-700">
                                Відправка
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-extrabold px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                                Прихід
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-indigo-600 mr-2">{log.sku}</span>
                            <span className="text-slate-600 text-xs hidden md:inline">{log.productName}</span>
                          </td>
                          <td className={`p-4 font-extrabold text-base ${log.type==='OUT'?'text-amber-500':'text-emerald-500'}`}>
                            {log.type === 'OUT' ? '-' : '+'}{log.changeQty}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-800">{log.newBalance} шт</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RECONCILIATION TAB */}
            {activeTab === 'reconciliation' && (
              <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
                <h3 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-indigo-600" />
                  Резервне копіювання бази
                </h3>
                <div className="flex flex-wrap gap-4">
                  <button onClick={exportDataJSON} className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm">
                    <Download className="w-5 h-5"/> Зберегти файл (Експорт)
                  </button>
                  <label className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer">
                    <Upload className="w-5 h-5 text-indigo-600"/> Завантажити файл (Імпорт)
                    <input type="file" className="hidden" onChange={importDataJSON}/>
                  </label>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
