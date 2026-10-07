import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Truck, History, CheckCircle2, AlertTriangle, XCircle, Search, 
  PlusCircle, MinusCircle, Box, Download, Upload, RefreshCw, BarChart3, 
  Layers, ArrowDownLeft, ArrowUpRight, Filter, CheckCircle,
  Cloud, CloudOff, Settings, Save, Github, RefreshCcw
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
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', path: 'database.json' };
  });
  const [fileSha, setFileSha] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error

  // Navigation
  const [activeTab, setActiveTab] = useState('inventory');
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

  const showNotice = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // -----------------------------------------------------
  // GitHub Cloud Synchronization Logic
  // -----------------------------------------------------
  const hasGithubSetup = !!(githubConfig.token && githubConfig.owner && githubConfig.repo);

  const fetchFromGithub = async () => {
    if (!hasGithubSetup) return;
    setSyncStatus('syncing');
    try {
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
      showNotice('Помилка завантаження з GitHub. Перевірте налаштування.', 'error');
    }
  };

  const pushToGithub = async (newProducts, newLogs) => {
    if (!hasGithubSetup) return;
    setSyncStatus('syncing');
    try {
      const content = b64EncodeUnicode(JSON.stringify({ products: newProducts, logs: newLogs }, null, 2));
      const body = {
        message: `SkladControl update: ${new Date().toLocaleString('uk-UA')}`,
        content: content,
      };
      // Fetch latest SHA right before pushing to avoid conflicts
      try {
        const getRes = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
            headers: { 'Authorization': `token ${githubConfig.token}` }
        });
        if (getRes.ok) {
            const data = await getRes.json();
            body.sha = data.sha;
        }
      } catch(e) { /* might be new file */ }

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

  // Load from Github on startup if configured
  useEffect(() => {
    if (hasGithubSetup && !fileSha) {
      fetchFromGithub();
    }
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

    // Sync to github immediately after update
    if (hasGithubSetup) {
      await pushToGithub(updatedProducts, newLogs);
    }
  };

  const exportDataJSON = () => { /* keeping export function */
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ products, logs }, null, 2));
    const a = document.createElement('a'); a.href = dataStr; a.download = `sklad_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const importDataJSON = (e) => {
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
            if (hasGithubSetup) pushToGithub(parsed.products, parsed.logs || logs);
          }
        } catch (err) {}
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                СкладКонтроль Cloud
                {hasGithubSetup && syncStatus === 'success' && <Cloud className="w-5 h-5 text-emerald-400" title="Синхронізовано з GitHub" />}
                {hasGithubSetup && syncStatus === 'syncing' && <RefreshCcw className="w-5 h-5 text-blue-400 animate-spin" />}
                {hasGithubSetup && syncStatus === 'error' && <CloudOff className="w-5 h-5 text-rose-400" title="Помилка синхронізації" />}
              </h1>
              <p className="text-xs text-slate-400">Автономний облік залишків</p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/80 text-sm font-medium w-full sm:w-auto overflow-x-auto">
            {['inventory', 'operations', 'history', 'reconciliation', 'settings'].map(tab => (
              <button
                key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab === 'inventory' && <Layers className="w-4 h-4" />}
                {tab === 'operations' && <Truck className="w-4 h-4" />}
                {tab === 'history' && <History className="w-4 h-4" />}
                {tab === 'reconciliation' && <BarChart3 className="w-4 h-4" />}
                {tab === 'settings' && <Settings className="w-4 h-4" />}
                {tab === 'inventory' ? 'Товари' : tab === 'operations' ? 'Операції' : tab === 'history' ? 'Історія' : tab === 'reconciliation' ? 'Звірка' : 'Налаштування'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${notification.type === 'error' ? 'bg-rose-900 border-rose-500 text-rose-100' : 'bg-emerald-900 border-emerald-500 text-emerald-100'}`}>
            {notification.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span>{notification.msg}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Github className="w-6 h-6 text-slate-300" />
              Хмарна синхронізація через GitHub
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Налаштуйте з'єднання з вашим приватним GitHub репозиторієм. Всі зміни залишків будуть автоматично зберігатися як коміти. Це забезпечить 100% збереження даних і можливість працювати з будь-якого пристрою.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Personal Access Token (classic)</label>
                <input type="password" placeholder="ghp_xxxxxxxxxxxx" value={githubConfig.token} onChange={e => setGithubConfig({...githubConfig, token: e.target.value})} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none" />
                <p className="text-xs text-slate-500 mt-1">Токен з правами "repo" (доступу до приватних репозиторіїв).</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Owner (Ваш логін)</label>
                  <input type="text" placeholder="Yaroslav" value={githubConfig.owner} onChange={e => setGithubConfig({...githubConfig, owner: e.target.value})} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Repository Name</label>
                  <input type="text" placeholder="sklad-control" value={githubConfig.repo} onChange={e => setGithubConfig({...githubConfig, repo: e.target.value})} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">File Path</label>
                <input type="text" value={githubConfig.path} onChange={e => setGithubConfig({...githubConfig, path: e.target.value})} className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl p-3 text-slate-100 text-sm outline-none" />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={fetchFromGithub} className="flex-1 py-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/50 rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                  <Download className="w-5 h-5" /> Завантажити з хмари
                </button>
                <button onClick={() => pushToGithub(products, logs)} className="flex-1 py-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/50 rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                  <Upload className="w-5 h-5" /> Примусово зберегти
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keeping original tabs simple rendering */}
        {activeTab !== 'settings' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-sm"><span className="text-xs font-semibold text-slate-400 uppercase">Позицій</span><div className="mt-2 text-2xl font-bold text-white">{summaryMetrics.totalItemsCount}</div></div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-sm"><span className="text-xs font-semibold text-slate-400 uppercase">Отримано</span><div className="mt-2 text-2xl font-bold text-emerald-400">{summaryMetrics.totalReceived}</div></div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-sm"><span className="text-xs font-semibold text-slate-400 uppercase">Відправлено</span><div className="mt-2 text-2xl font-bold text-amber-400">{summaryMetrics.totalSent}</div></div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-sm"><span className="text-xs font-semibold text-slate-400 uppercase">Залишок</span><div className="mt-2 text-2xl font-bold text-blue-400">{summaryMetrics.totalInStock}</div></div>
          </div>
        )}

        {/* OPERATIONS TAB (Re-used mostly) */}
        {activeTab === 'operations' && (
          <div className="max-w-2xl mx-auto w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-xl">
             <h2 className="text-xl font-bold text-white mb-6">Проведення складської операції</h2>
             <form onSubmit={handleExecuteOperation} className="space-y-4">
               {/* Controls */}
               <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-900 p-1.5 rounded-xl">
                  <button type="button" onClick={() => setOpType('OUT')} className={`py-2 px-3 rounded-lg text-sm ${opType==='OUT'?'bg-amber-600 text-white':'text-slate-400'}`}>Відправка</button>
                  <button type="button" onClick={() => setOpType('IN')} className={`py-2 px-3 rounded-lg text-sm ${opType==='IN'?'bg-emerald-600 text-white':'text-slate-400'}`}>Прихід</button>
                  <button type="button" onClick={() => setOpType('NEW')} className={`py-2 px-3 rounded-lg text-sm ${opType==='NEW'?'bg-blue-600 text-white':'text-slate-400'}`}>Новий</button>
               </div>
               
               {opType === 'NEW' ? (
                 <div className="grid gap-4">
                   <input required placeholder="Артикул" value={opSku} onChange={e=>setOpSku(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 w-full outline-none" />
                   <input required placeholder="Назва товару" value={newProductName} onChange={e=>setNewProductName(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 w-full outline-none" />
                 </div>
               ) : (
                 <input required placeholder="Введіть артикул..." list="sku-list" value={opSku} onChange={e=>{setOpSku(e.target.value.toUpperCase()); const m = products.find(p=>p.sku===e.target.value.toUpperCase()); if(m) setOpBox(m.boxNumber);}} className="bg-slate-900 p-3 rounded-xl border border-slate-700 w-full outline-none" />
               )}
               <datalist id="sku-list">{products.map(p => <option key={p.id} value={p.sku}>{p.name}</option>)}</datalist>

               <div className="grid grid-cols-2 gap-4">
                 <input required type="number" placeholder="Кількість шт" value={opQty} onChange={e=>setOpQty(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 outline-none" />
                 <input placeholder="Коробка (необов'язково)" value={opBox} onChange={e=>setOpBox(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 outline-none" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <input placeholder="Замовлення/Документ" value={opOrderRef} onChange={e=>setOpOrderRef(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 outline-none" />
                 <input placeholder="Примітка" value={opNote} onChange={e=>setOpNote(e.target.value)} className="bg-slate-900 p-3 rounded-xl border border-slate-700 outline-none" />
               </div>
               <button type="submit" className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg ${opType==='OUT'?'bg-amber-600':opType==='IN'?'bg-emerald-600':'bg-blue-600'}`}>
                 Підтвердити операцію
               </button>
             </form>
          </div>
        )}

        {/* QUICK RENDER INVENTORY */}
        {activeTab === 'inventory' && (
           <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400">
                 <tr><th className="p-4">Артикул</th><th className="p-4">Назва</th><th className="p-4 text-right">Залишок</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-700/60">
                 {filteredProducts.map(p => (
                   <tr key={p.id} className="hover:bg-slate-700/30">
                     <td className="p-4 font-mono text-blue-400">{p.sku}</td>
                     <td className="p-4">{p.name} <span className="ml-2 text-xs text-slate-500">[{p.boxNumber}]</span></td>
                     <td className="p-4 text-right font-bold">{p.receivedQty - p.sentQty} шт</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}

        {/* QUICK RENDER HISTORY */}
        {activeTab === 'history' && (
           <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
             <table className="w-full text-left text-sm">
               <thead className="bg-slate-900/60 border-b border-slate-700 text-slate-400">
                 <tr><th className="p-4">Час</th><th className="p-4">Тип</th><th className="p-4">Товар</th><th className="p-4">Зміна</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-700/60">
                 {logs.map(log => (
                   <tr key={log.id}>
                     <td className="p-4 text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                     <td className={`p-4 font-bold ${log.type==='OUT'?'text-amber-400':'text-emerald-400'}`}>{log.type}</td>
                     <td className="p-4">{log.sku}</td>
                     <td className="p-4">{log.changeQty}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}

        {/* QUICK RENDER RECONCILIATION */}
        {activeTab === 'reconciliation' && (
           <div className="bg-slate-800 p-6 rounded-2xl shadow-xl flex gap-4">
             <button onClick={exportDataJSON} className="px-4 py-2 bg-slate-700 text-white rounded flex gap-2"><Download className="w-4 h-4"/> Експорт локально</button>
             <label className="px-4 py-2 bg-slate-700 text-white rounded flex gap-2 cursor-pointer"><Upload className="w-4 h-4"/> Імпорт локально<input type="file" className="hidden" onChange={importDataJSON}/></label>
           </div>
        )}

      </main>
    </div>
  );
}
