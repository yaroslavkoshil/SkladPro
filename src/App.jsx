import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Truck, History, CheckCircle2, AlertTriangle, XCircle, Search, 
  PlusCircle, MinusCircle, Box, Download, Upload, RefreshCw, BarChart3, 
  Layers, ArrowDownLeft, ArrowUpRight, Filter, CheckCircle,
  Cloud, CloudOff, Settings, Save, Server, RefreshCcw, Menu, Info, X, Trash2, RotateCcw
} from 'lucide-react';

const OFFICIAL_CATEGORY_ORDER = [
  'Інвертори',
  'Інвертори / Зарядні пристрої',
  'Зарядні пристрої',
  'DC-DC перетворювачі',
  'Сонячні контролери заряду',
  'Трансформатори та Гальванічні ізолятори',
  'Автоматичні перемикачі резерву',
  'Розподіл постійного струму та Запобіжники',
  'Пристрої GX та Віддалені панелі',
  'Кабелі передачі даних та Інтерфейси',
  'Моніторинг батарей',
  'Батарейні ізолятори та Захист',
  'Батареї та BMS',
  'Сонячні панелі',
  'Станції зарядки EV',
  'Кабелі берегового живлення',
  'Сонячні домашні системи (SHS)',
  'Інше'
];

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

  const [categoryOrder, setCategoryOrder] = useState(() => {
    const saved = localStorage.getItem('wh_category_order_v1');
    return saved ? JSON.parse(saved) : OFFICIAL_CATEGORY_ORDER;
  });
  
  const [trash, setTrash] = useState(() => {
    const saved = localStorage.getItem('wh_trash_v1');
    return saved ? JSON.parse(saved) : [];
  });

  // Drag and Drop State
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [draggedCategory, setDraggedCategory] = useState(null);

  // Auto-cleanup trash (older than 30 days) and sync state to local storage
  useEffect(() => {
    const now = new Date();
    const filteredTrash = trash.filter(t => {
      const daysOld = (now - new Date(t.deletedAt)) / (1000 * 60 * 60 * 24);
      return daysOld <= 30;
    });
    
    if (filteredTrash.length !== trash.length) {
      setTrash(filteredTrash);
    }
    
    localStorage.setItem('wh_products_v1', JSON.stringify(products));
    localStorage.setItem('wh_logs_v1', JSON.stringify(logs));
    localStorage.setItem('wh_category_order_v1', JSON.stringify(categoryOrder));
    localStorage.setItem('wh_trash_v1', JSON.stringify(filteredTrash));
  }, [products, logs, categoryOrder, trash]);
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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // UI State
  const [notification, setNotification] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Editing State
  const [editingLogId, setEditingLogId] = useState(null);
  const [editLogData, setEditLogData] = useState({});
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editProductData, setEditProductData] = useState({});
  const [expandedBoxes, setExpandedBoxes] = useState({});


  // Operation Form State (for generic New Operation tab)
  const [opSku, setOpSku] = useState('');
  const [opCategory, setOpCategory] = useState('');
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

  // Column Resize State
  const [nameColWidth, setNameColWidth] = useState(300);

  const handleResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = nameColWidth;
    
    const onMouseMove = (moveEvent) => {
      setNameColWidth(Math.max(150, startWidth + moveEvent.clientX - startX));
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  // Save to LocalStorage
  useEffect(() => { localStorage.setItem('wh_products_v1', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('wh_logs_v1', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('wh_github_config', JSON.stringify(githubConfig)); }, [githubConfig]);
  useEffect(() => { sessionStorage.setItem('wh_is_admin', isAdmin); }, [isAdmin]);


  const showNotice = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const printBoxLabel = (boxNumber) => {
    const win = window.open('', '_blank', 'width=400,height=400');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Коробка ${boxNumber}</title>
        <style>
          @page { size: 10cm 10cm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 10cm; height: 10cm; display: flex; align-items: center; justify-content: center; }
          .label { font-family: Arial Black, Arial, sans-serif; font-weight: 900; font-size: 4cm; text-align: center; line-height: 1; color: #000; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        <div class="label">${boxNumber}</div>
      </body>
      </html>
    `);
    win.document.close();
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
      if (parsed && parsed.categories) setCategoryOrder(parsed.categories);
      if (parsed && parsed.trash) setTrash(parsed.trash);
      setSyncStatus('success');
      showNotice('Дані успішно оновлено!');
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      showNotice('Помилка завантаження даних', 'error');
    }
  };

  const pushToGithub = async (newProducts, newLogs, newCategories = categoryOrder, newTrash = trash) => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) return;
    setSyncStatus('syncing');
    try {
      const content = b64EncodeUnicode(JSON.stringify({ products: newProducts, logs: newLogs, categories: newCategories, trash: newTrash }, null, 2));
      const body = { message: `SkladControl update: ${new Date().toLocaleString('uk-UA')}`, content: content };
      try {
        const getRes = await fetch(`https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`, {
            headers: { 'Authorization': `token ${githubConfig.token}` },
            cache: 'no-store'
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
  const allCategories = useMemo(() => {
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort((a, b) => {
      let idxA = categoryOrder.indexOf(a);
      let idxB = categoryOrder.indexOf(b);
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;
      if (idxA !== idxB) return idxA - idxB;
      return a.localeCompare(b);
    });
  }, [products, categoryOrder]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const currentBalance = p.receivedQty - p.sentQty;
      const matchesSearch = p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBox = selectedBoxFilter === 'ALL' || p.boxNumber.toUpperCase() === selectedBoxFilter.toUpperCase();
      const matchesCategory = selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter;
      let matchesStatus = true;
      if (statusFilter === 'IN_STOCK') matchesStatus = currentBalance > p.minQty;
      if (statusFilter === 'LOW_STOCK') matchesStatus = currentBalance > 0 && currentBalance <= p.minQty;
      if (statusFilter === 'OUT_OF_STOCK') matchesStatus = currentBalance <= 0;
      return matchesSearch && matchesBox && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedBoxFilter, selectedCategoryFilter, statusFilter]);

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
  const executeOperationCore = async (type, sku, qty, box, note, orderRef, newName = null, newMin = 10, newCategory = 'Інше') => {
    if (!isAdmin) { showNotice('У вас немає прав для редагування', 'error'); return false; }
    
    let updatedProducts = [...products];
    let newLogs = [...logs];

    if (type === 'NEW') {
      const trimmedSku = sku.trim().toUpperCase();
      if (!trimmedSku || !newName?.trim()) { showNotice('Заповніть обов’язкові поля', 'error'); return false; }
      if (products.some(p => p.sku.toUpperCase() === trimmedSku)) { showNotice(`Артикул "${trimmedSku}" вже існує!`, 'error'); return false; }

      const finalBox = box.trim().toUpperCase() || 'Б/Н';
      updatedProducts = [{
        id: `prod-${Date.now()}`, sku: trimmedSku, name: newName.trim(), boxNumber: finalBox, category: newCategory,
        receivedQty: qty, sentQty: 0, minQty: newMin, sortIndex: 999999, updatedAt: new Date().toISOString()
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
      // Accumulate boxes: add new box if it's different from existing ones
      const existingBoxes = (targetProduct.boxNumber || '').split(',').map(b => b.trim()).filter(Boolean);
      const updatedBox = (box.trim() && !existingBoxes.includes(box.trim().toUpperCase()))
        ? [...existingBoxes, box.trim().toUpperCase()].join(', ')
        : targetProduct.boxNumber || finalBox;

      updatedProducts = products.map(p => p.id === targetProduct.id ? 
        { ...p, receivedQty: updatedReceived, sentQty: updatedSent, boxNumber: updatedBox, updatedAt: new Date().toISOString() } : p);

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
      setOpCategory('');
    }
  };

  const handleExecuteOperation = async (e) => {
    e.preventDefault();
    const qty = parseInt(opQty, 10);
    if (isNaN(qty) || qty <= 0) return showNotice('Вкажіть коректну кількість', 'error');
    
    const existing = products.find(p => p.sku.toUpperCase() === opSku.trim().toUpperCase());
    const type = existing ? 'IN' : 'NEW';
    
    const success = await executeOperationCore(type, opSku, qty, opBox, opNote, opOrderRef, newProductName, 10, opCategory || 'Інше');
    if (success) {
      setOpSku(''); setOpQty(''); setNewProductName(''); setOpNote(''); setOpOrderRef(''); setOpBox(''); setOpCategory('');
    }
  };

  // -----------------------------------------------------
  // Drag and Drop Logic
  // -----------------------------------------------------
  const handleCategoryDragStart = (e, cat) => {
    setDraggedCategory(cat);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };
  const handleCategoryDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedCategory(null);
  };
  const handleCategoryDragOver = (e, targetCat) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCat) return;
    const newOrder = [...categoryOrder];
    const draggedIdx = newOrder.indexOf(draggedCategory);
    const targetIdx = newOrder.indexOf(targetCat);
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedCategory);
    setCategoryOrder(newOrder);
  };
  
  const handleProductDragStart = (e, p) => {
    setDraggedProduct(p);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
  };
  const handleProductDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedProduct(null);
  };
  const handleProductDragOver = (e, targetP) => {
    e.preventDefault();
    if (!draggedProduct || draggedProduct.id === targetP.id) return;
    
    const updatedProducts = [...products];
    const draggedIdx = updatedProducts.findIndex(x => x.id === draggedProduct.id);
    const targetIdx = updatedProducts.findIndex(x => x.id === targetP.id);
    
    // Update category visually while dragging
    updatedProducts[draggedIdx].category = targetP.category;
    
    const [removed] = updatedProducts.splice(draggedIdx, 1);
    updatedProducts.splice(targetIdx, 0, removed);
    
    // Re-assign sort indices for both categories if changed
    updatedProducts.forEach((p, idx) => {
      p.sortIndex = idx;
    });
    
    setProducts(updatedProducts);
  };
  const handleProductDrop = async (e) => {
    e.preventDefault();
    if (githubConfig.token) await pushToGithub(products, logs);
  };
  const handleCategoryDrop = async (e) => {
    e.preventDefault();
    if (githubConfig.token) await pushToGithub(products, logs, categoryOrder);
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

  const updateProductFromLogs = (targetSku, currentLogs, currentProducts) => {
    const clonedLogs = currentLogs.map(l => ({...l})); 
    let newReceived = 0; let newSent = 0;
    const searchSku = targetSku.trim().toUpperCase();
    
    const prodLogs = clonedLogs.filter(l => l.sku.trim().toUpperCase() === searchSku).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let runningBalance = 0;
    prodLogs.forEach(pl => {
       if (pl.type === 'IN') { runningBalance += Number(pl.changeQty); newReceived += Number(pl.changeQty); } 
       else { runningBalance -= Number(pl.changeQty); newSent += Number(pl.changeQty); }
       pl.newBalance = runningBalance; 
    });

    clonedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const newProducts = currentProducts.map(p => p.sku.trim().toUpperCase() === searchSku ? { ...p, receivedQty: newReceived, sentQty: newSent } : p);
    return { newProducts, newLogs: clonedLogs };
  };

  const startEditingProduct = () => { setIsEditingProduct(true); setEditProductData({ ...selectedProduct }); };

  const startEditingLog = (log) => { setEditingLogId(log.id); setEditLogData({...log}); };

  const getLocalDatetimeLocal = (isoStr) => {
     try {
       const d = new Date(isoStr);
       const pad = (n) => n.toString().padStart(2, '0');
       return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
     } catch (e) { return ''; }
  };

  const handleSaveProductEdit = () => {
    if (!editProductData.sku || !editProductData.name) return showNotice('Артикул та Назва обов\'язкові', 'error');
    const newProducts = products.map(p => p.id === selectedProduct.id ? { ...p, ...editProductData } : p);
    let newLogs = [...logs];
    if (editProductData.sku !== selectedProduct.sku || editProductData.name !== selectedProduct.name) {
       newLogs = logs.map(l => l.sku === selectedProduct.sku ? { ...l, sku: editProductData.sku, productName: editProductData.name } : l);
    }
    setProducts(newProducts); setLogs(newLogs); pushToGithub(newProducts, newLogs);
    setSelectedProduct(newProducts.find(p => p.id === selectedProduct.id));
    setIsEditingProduct(false); showNotice('Товар оновлено');
  };

  const handleDeleteProduct = () => {
    if (!window.confirm('Ви дійсно хочете перемістити цей товар у кошик?')) return;
    const newProducts = products.filter(p => p.id !== selectedProduct.id);
    const productLogs = logs.filter(l => l.sku === selectedProduct.sku);
    const newLogs = logs.filter(l => l.sku !== selectedProduct.sku);
    
    const newTrashItem = {
      type: 'PRODUCT',
      data: selectedProduct,
      logs: productLogs,
      deletedAt: new Date().toISOString(),
      id: `trash-${Date.now()}`
    };
    const newTrash = [newTrashItem, ...trash];

    setProducts(newProducts); setLogs(newLogs); setTrash(newTrash);
    pushToGithub(newProducts, newLogs, categoryOrder, newTrash);
    setSelectedProduct(null); showNotice('Товар переміщено у кошик');
  };

  const handleDeleteLog = (logId, sku) => {
    if (!window.confirm('Перемістити цей запис у кошик? Це змінить залишки товару.')) return;
    const logToDelete = logs.find(l => l.id === logId);
    const { newProducts, newLogs } = updateProductFromLogs(sku, logs.filter(l => l.id !== logId), products);
    
    const newTrashItem = {
      type: 'LOG',
      data: logToDelete,
      deletedAt: new Date().toISOString(),
      id: `trash-${Date.now()}`
    };
    const newTrash = [newTrashItem, ...trash];

    setLogs(newLogs); setProducts(newProducts); setTrash(newTrash);
    pushToGithub(newProducts, newLogs, categoryOrder, newTrash);
    if (selectedProduct && selectedProduct.sku.trim().toUpperCase() === sku.trim().toUpperCase()) {
      setSelectedProduct(newProducts.find(p => p.sku.trim().toUpperCase() === sku.trim().toUpperCase())); 
    }
    showNotice('Запис переміщено у кошик');
  };

  const handleRestoreFromTrash = (trashItem) => {
    let newProducts = [...products];
    let newLogs = [...logs];
    
    if (trashItem.type === 'PRODUCT') {
       if (products.some(p => p.sku.toUpperCase() === trashItem.data.sku.toUpperCase())) {
          return showNotice('Товар з таким артикулом вже існує!', 'error');
       }
       newProducts.push(trashItem.data);
       newLogs = [...newLogs, ...(trashItem.logs || [])];
    } else if (trashItem.type === 'LOG') {
       newLogs.push(trashItem.data);
       const { newProducts: np, newLogs: nl } = updateProductFromLogs(trashItem.data.sku, newLogs, newProducts);
       newProducts = np;
       newLogs = nl;
    }
    
    const newTrash = trash.filter(t => t.id !== trashItem.id);
    setProducts(newProducts); setLogs(newLogs); setTrash(newTrash);
    pushToGithub(newProducts, newLogs, categoryOrder, newTrash);
    showNotice('Відновлено з кошика!');
  };

  const handleDeletePermanent = (trashItem) => {
    if (!window.confirm('Видалити назавжди? Цю дію неможливо скасувати!')) return;
    const newTrash = trash.filter(t => t.id !== trashItem.id);
    setTrash(newTrash);
    pushToGithub(products, logs, categoryOrder, newTrash);
    showNotice('Видалено назавжди');
  };


  const handleSaveLogEdit = (logId, sku) => {
    const qty = parseInt(editLogData.changeQty, 10);
    if (isNaN(qty) || qty <= 0) return showNotice('Кількість повинна бути більше 0', 'error');
    let updatedDate = new Date(editLogData.timestamp);
    if (isNaN(updatedDate.getTime())) return showNotice('Невірний формат дати', 'error');
    const updatedLogs = logs.map(l => l.id === logId ? { 
      ...l, changeQty: qty, note: editLogData.note, orderId: editLogData.orderId, timestamp: updatedDate.toISOString()
    } : l);
    const { newProducts, newLogs } = updateProductFromLogs(sku, updatedLogs, products);
    setLogs(newLogs); setProducts(newProducts); pushToGithub(newProducts, newLogs);
    if (selectedProduct && selectedProduct.sku.trim().toUpperCase() === sku.trim().toUpperCase()) {
      setSelectedProduct(newProducts.find(p => p.sku.trim().toUpperCase() === sku.trim().toUpperCase()));
    }
    setEditingLogId(null); showNotice('Запис оновлено');
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
    { id: 'trash', label: 'Кошик', icon: Trash2, adminOnly: true },
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
                    
                    {/* Show category select only if it's a new product */}
                    {!products.some(p => p.sku.toUpperCase() === opSku.toUpperCase()) && (
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Розділ (Категорія)</label>
                        <select 
                           value={opCategory} 
                           onChange={e=>setOpCategory(e.target.value)} 
                           className="bg-white p-3.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 w-full outline-none"
                        >
                           <option value="">-- Оберіть розділ (або залишіть Інше) --</option>
                           {OFFICIAL_CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
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
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)} className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer max-w-[150px]">
                        <option value="ALL">Всі розділи ({allCategories.length})</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                      <Box className="w-4 h-4 text-slate-400" />
                      <select value={selectedBoxFilter} onChange={(e) => setSelectedBoxFilter(e.target.value)} className="bg-transparent text-sm text-slate-700 font-medium outline-none cursor-pointer">
                        <option value="ALL">Всі коробки ({allBoxes.length})</option>
                        {allBoxes.map(b => <option key={b} value={b}>{b}</option>)}
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
                          <th className="py-2 px-3 pl-6">Артикул (SKU)</th>
                          <th className="p-0 relative group select-none" style={{ width: nameColWidth, minWidth: nameColWidth, maxWidth: nameColWidth }}>
                            <div className="py-2 px-3 flex items-center justify-between overflow-hidden">
                              Назва товару
                            </div>
                            {/* Drag Handle */}
                            <div 
                              onMouseDown={handleResizeStart}
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 bg-transparent transition-colors z-10"
                              title="Потягніть, щоб змінити ширину"
                            />
                          </th>
                          <th className="py-2 px-2 text-center">Отримано</th>
                          <th className="py-2 px-2 text-center">Відправлено</th>
                          <th className="py-2 px-2 text-center">Залишок</th>
                          <th className="py-2 px-2 text-center">Дії</th>
                          <th className="py-2 px-2 text-center">Точність</th>
                          <th className="py-2 px-3 pr-6 text-center">Коробка</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(
                          filteredProducts.reduce((acc, p) => {
                            const cat = p.category || 'Інше';
                            if (!acc[cat]) acc[cat] = [];
                            acc[cat].push(p);
                            return acc;
                          }, {})
                        )
                        .sort(([catA], [catB]) => {
                           let idxA = categoryOrder.indexOf(catA);
                           let idxB = categoryOrder.indexOf(catB);
                           if (idxA === -1) idxA = 999;
                           if (idxB === -1) idxB = 999;
                           if (idxA !== idxB) return idxA - idxB;
                           return catA.localeCompare(catB);
                        })
                        .map(([cat, prods]) => {
                          const sortedProds = [...prods].sort((a, b) => {
                             if (a.sortIndex !== undefined && b.sortIndex !== undefined) return a.sortIndex - b.sortIndex;
                             return a.sku.localeCompare(b.sku);
                          });
                          return (
                          <React.Fragment key={cat}>
                            <tr 
                              className="bg-indigo-50/70 border-y border-indigo-100/70"
                              draggable={isAdmin}
                              onDragStart={(e) => handleCategoryDragStart(e, cat)}
                              onDragOver={(e) => handleCategoryDragOver(e, cat)}
                              onDragEnd={handleCategoryDragEnd}
                              onDrop={handleCategoryDrop}
                              style={{ cursor: isAdmin ? 'grab' : 'default', opacity: draggedCategory === cat ? 0.5 : 1 }}
                            >
                              <td colSpan="8" className="py-2 px-3 pl-6 font-extrabold text-indigo-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] text-sm">
                                📁 {cat} <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-200">{prods.length} поз.</span>
                                {isAdmin && <span className="ml-2 text-[10px] font-medium text-indigo-400 font-mono">(перетягніть мишкою)</span>}
                              </td>
                            </tr>
                            {sortedProds.map(p => {
                              const bal = p.receivedQty - p.sentQty;
                              return (
                                <tr 
                                  key={p.id} 
                                  className="hover:bg-slate-50/80 transition-colors"
                                  draggable={isAdmin}
                                  onDragStart={(e) => handleProductDragStart(e, p)}
                                  onDragOver={(e) => handleProductDragOver(e, p)}
                                  onDragEnd={handleProductDragEnd}
                                  onDrop={handleProductDrop}
                                  style={{ cursor: isAdmin ? 'grab' : 'default', opacity: draggedProduct?.id === p.id ? 0.4 : 1 }}
                                >
                                  <td className="px-3 py-1 pl-6 font-mono font-bold text-indigo-600 text-xs">{p.sku}</td>
                                  <td className="px-3 py-1 font-medium text-slate-800 whitespace-normal break-words text-xs" style={{ width: nameColWidth, minWidth: nameColWidth, maxWidth: nameColWidth }}>
                                    {p.name}
                                  </td>
                                  <td className="px-2 py-1 text-center font-black text-emerald-600">+{p.receivedQty}</td>
                                  <td className="px-2 py-1 text-center font-black text-amber-500">-{p.sentQty}</td>
                                  <td className="px-2 py-1 text-center">
                                    <span className={`text-base font-black ${bal <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>{bal}</span>
                                    <span className="text-[10px] font-bold text-slate-400 ml-1">шт</span>
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <button onClick={() => openProductModal(p)} className="px-2 py-0.5 border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[10px] font-bold transition-colors inline-flex items-center gap-1">
                                      Картка
                                    </button>
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50">
                                      <CheckCircle className="w-2.5 h-2.5" />
                                    </span>
                                  </td>
                                  <td className="px-3 py-1 pr-6 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[10px] border border-slate-200 font-bold">
                                      <Box className="w-3 h-3 text-slate-400"/> {p.boxNumber}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        )})}
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
                        <th className="py-2 px-3 pl-6">Дата та час</th>
                        <th className="py-2 px-3">Тип</th>
                        <th className="py-2 px-3">Артикул / Назва</th>
                        <th className="py-2 px-2 text-center">Коробка</th>
                        <th className="py-2 px-2 text-center">Зміна</th>
                        <th className="py-2 px-2 text-center">Залишок після</th>
                        <th className="py-2 px-3 pr-6">Документ / Примітка</th>
                        {isAdmin && <th className="py-2 px-3 pr-6 text-center">Дії</th>}
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
                            <td colSpan={isAdmin ? "8" : "7"} className="py-1 px-3 pl-6 font-extrabold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                              📅 ОПЕРАЦІЇ ЗА {date.toUpperCase()} <span className="ml-2 text-[10px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{dayLogs.length} записів</span>
                            </td>
                          </tr>
                          {dayLogs.map(log => (
                             editingLogId === log.id ? (
                                <tr key={log.id} className="bg-indigo-50 border-y border-indigo-100">
                                   <td colSpan={isAdmin ? "8" : "7"} className="p-4">
                                     <div className="flex flex-wrap gap-3 items-end">
                                        <div className="flex flex-col gap-1 w-24">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">Кіл-ть</label>
                                          <input type="number" className="p-2 rounded border border-slate-300 font-bold text-sm" value={editLogData.changeQty} onChange={e=>setEditLogData({...editLogData, changeQty: e.target.value})} />
                                        </div>
                                        <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">ТТН</label>
                                          <input type="text" className="p-2 rounded border border-slate-300 text-sm font-medium" value={editLogData.orderId || ''} onChange={e=>setEditLogData({...editLogData, orderId: e.target.value})} />
                                        </div>
                                        <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">Примітка</label>
                                          <input type="text" className="p-2 rounded border border-slate-300 text-sm font-medium" value={editLogData.note || ''} onChange={e=>setEditLogData({...editLogData, note: e.target.value})} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase">Час</label>
                                          <input type="datetime-local" className="p-2 rounded border border-slate-300 text-sm font-medium" value={getLocalDatetimeLocal(editLogData.timestamp)} onChange={e => { const local = new Date(e.target.value); if(!isNaN(local.getTime())) setEditLogData({...editLogData, timestamp: local.toISOString()}) }} />
                                        </div>
                                        <div className="flex gap-2">
                                           <button onClick={() => handleSaveLogEdit(log.id, log.sku)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs shadow-sm transition-colors">Зберегти</button>
                                           <button onClick={() => setEditingLogId(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold text-xs shadow-sm transition-colors">Скасувати</button>
                                        </div>
                                     </div>
                                   </td>
                                </tr>
                             ) : (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3 py-1.5 pl-6 text-xs font-medium text-slate-500">{new Date(log.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="px-3 py-1.5">
                                {log.type === 'OUT' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    <ArrowUpRight className="w-3 h-3"/> Відправка
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <ArrowDownLeft className="w-3 h-3"/> Прихід
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className="font-mono font-bold text-indigo-600 text-xs mr-2">{log.sku}</span>
                                <span className="text-slate-800 font-medium text-xs">{log.productName}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                 <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{log.boxNumber}</span>
                              </td>
                              <td className={`px-2 py-1.5 text-center font-extrabold text-sm ${log.type==='OUT'?'text-amber-500':'text-emerald-500'}`}>
                                {log.type === 'OUT' ? '-' : '+'}{log.changeQty}
                              </td>
                              <td className="px-2 py-1.5 text-center font-bold text-slate-800 text-sm">
                                {log.newBalance} <span className="text-[10px] text-slate-400 font-normal">шт</span>
                              </td>
                              <td className="px-3 py-1.5 pr-6 text-slate-600 text-xs">
                                {log.orderId && (
                                  /^\d{12,14}$/.test(log.orderId.trim())
                                    ? <a href={`https://novaposhta.ua/tracking/${log.orderId.trim()}`} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline mr-1 transition-colors" title="Відстежити ТТН на Новій Пошті">[{log.orderId}] 🔗</a>
                                    : <span className="font-bold text-slate-700 mr-1">[{log.orderId}]</span>
                                )}
                                {log.note}
                              </td>
                              {isAdmin && (
                                <td className="px-3 py-1.5 pr-6 text-center">
                                  <div className="flex gap-2 justify-center opacity-50 hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditingLog(log)} className="text-[10px] text-indigo-600 hover:text-indigo-800 uppercase font-extrabold flex items-center gap-1">✎ Редаг.</button>
                                    <button onClick={() => handleDeleteLog(log.id, log.sku)} className="text-[10px] text-rose-500 hover:text-rose-700 uppercase font-extrabold flex items-center gap-1">× Видал.</button>
                                  </div>
                                </td>
                              )}
                            </tr>
                            )
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RECONCILIATION TAB */}
            {activeTab === 'trash' && isAdmin && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                      <Trash2 className="w-7 h-7 text-rose-500" /> Кошик видалених елементів
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">Видалені товари та історія зберігаються тут протягом 30 днів. Після цього вони видаляються назавжди автоматично.</p>
                  </div>
                </div>

                {trash.length === 0 ? (
                  <div className="text-center py-12">
                     <Trash2 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                     <p className="text-slate-500 font-bold">Кошик порожній</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trash.map(t => {
                      const daysLeft = 30 - Math.floor((new Date() - new Date(t.deletedAt)) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={t.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${t.type === 'PRODUCT' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                               {t.type === 'PRODUCT' ? <Package className="w-6 h-6"/> : <History className="w-6 h-6"/>}
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                 <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 uppercase tracking-wider">{t.type === 'PRODUCT' ? 'Товар' : 'Запис'}</span>
                                 <span className="text-xs font-bold text-rose-500">Залишилося: {daysLeft} днів</span>
                               </div>
                               <h3 className="font-bold text-slate-800 text-lg mt-1">
                                 {t.type === 'PRODUCT' ? `[${t.data.sku}] ${t.data.name}` : `[${t.data.sku}] ${t.data.productName}`}
                               </h3>
                               <p className="text-sm text-slate-500">Видалено: {new Date(t.deletedAt).toLocaleString('uk-UA')}</p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => handleRestoreFromTrash(t)} className="flex-1 md:flex-none px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                              <RotateCcw className="w-4 h-4"/> Відновити
                            </button>
                            <button onClick={() => handleDeletePermanent(t)} className="flex-1 md:flex-none px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                              <X className="w-4 h-4"/> Видалити
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            
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
                          <span className="font-bold text-slate-700 flex items-center gap-1.5"><Box className="w-4 h-4 text-indigo-500"/> Коробка <span className="text-indigo-600">{box}</span></span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{data.count} артикулів</span>
                            <button onClick={() => printBoxLabel(box)} className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 transition-colors flex items-center gap-1" title="Надрукувати ярлик">
                              🖨️
                            </button>
                          </div>
                        </div>
                        <div className="text-2xl font-extrabold text-slate-800 mb-4">{data.items} <span className="text-sm font-normal text-slate-500">од. товарів</span></div>
                        <div className="mt-auto space-y-1">
                           {(expandedBoxes[box] ? data.products : data.products.slice(0, 3)).map(p => (
                             <div key={p.id} className="flex justify-between text-xs text-slate-500 items-center">
                               <span className="truncate pr-2">{p.sku} - {p.name}</span>
                               <span className="font-bold whitespace-nowrap">{p.receivedQty - p.sentQty} шт</span>
                             </div>
                           ))}
                           {data.products.length > 3 && (
                             <button 
                               onClick={() => setExpandedBoxes(prev => ({...prev, [box]: !prev[box]}))}
                               className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase pt-2 w-full text-left outline-none"
                             >
                               {expandedBoxes[box] ? 'ЗГОРНУТИ ↑' : `РОЗГОРНУТИ ВСІ (${data.products.length}) ↓`}
                             </button>
                           )}
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
              {isEditingProduct ? (
                <div className="flex-1 mr-4 space-y-3">
                  <div className="flex gap-3">
                     <input className="px-3 py-1 border border-slate-300 rounded-lg text-sm w-32" value={editProductData.sku} onChange={e=>setEditProductData({...editProductData, sku: e.target.value})} placeholder="Артикул" />
                     <input className="px-3 py-1 border border-slate-300 rounded-lg text-sm w-32" value={editProductData.boxNumber} onChange={e=>setEditProductData({...editProductData, boxNumber: e.target.value})} placeholder="Коробка" />
                  </div>
                  <input className="w-full px-3 py-2 border border-slate-300 rounded-lg text-lg font-bold" value={editProductData.name} onChange={e=>setEditProductData({...editProductData, name: e.target.value})} placeholder="Назва" />
                  <div className="flex gap-3">
                    <button onClick={handleSaveProductEdit} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-sm">Зберегти</button>
                    <button onClick={() => setIsEditingProduct(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-sm">Скасувати</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 font-bold font-mono text-sm rounded-lg">{selectedProduct.sku}</span>
                    <span className="px-3 py-1 bg-slate-200 text-slate-600 font-bold font-mono text-sm rounded-lg flex items-center gap-1.5"><Box className="w-4 h-4"/> {selectedProduct.boxNumber}</span>
                    {isAdmin && (
                      <div className="flex gap-2">
                         <button onClick={startEditingProduct} className="text-xs text-indigo-600 hover:text-indigo-800 underline font-bold px-2">✎ Редагувати</button>
                         <button onClick={handleDeleteProduct} className="text-xs text-rose-500 hover:text-rose-700 underline font-bold px-2">× Видалити товар</button>
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-800">{selectedProduct.name}</h2>
                </div>
              )}
              <button onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors mt-1">
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
                    editingLogId === log.id ? (
                      <div key={log.id} className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col gap-3 shadow-inner">
                        <div className="font-bold text-indigo-800 text-sm mb-1">Редагування операції ({log.type === 'OUT' ? 'Відправка' : 'Прихід'})</div>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex flex-col gap-1 w-24">
                            <label className="text-xs font-bold text-slate-500 uppercase">Кіл-ть</label>
                            <input type="number" className="p-2.5 rounded-lg border border-slate-300 font-bold" value={editLogData.changeQty} onChange={e=>setEditLogData({...editLogData, changeQty: e.target.value})} />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                            <label className="text-xs font-bold text-slate-500 uppercase">ТТН</label>
                            <input type="text" className="p-2.5 rounded-lg border border-slate-300 text-sm font-medium" value={editLogData.orderId || ''} onChange={e=>setEditLogData({...editLogData, orderId: e.target.value})} />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                            <label className="text-xs font-bold text-slate-500 uppercase">Примітка</label>
                            <input type="text" className="p-2.5 rounded-lg border border-slate-300 text-sm font-medium" value={editLogData.note || ''} onChange={e=>setEditLogData({...editLogData, note: e.target.value})} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Час операції</label>
                            <input type="datetime-local" className="p-2.5 rounded-lg border border-slate-300 text-sm font-medium" value={getLocalDatetimeLocal(editLogData.timestamp)} onChange={e => { const local = new Date(e.target.value); if(!isNaN(local.getTime())) setEditLogData({...editLogData, timestamp: local.toISOString()}) }} />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                           <button onClick={() => handleSaveLogEdit(log.id)} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm transition-colors">Зберегти зміни</button>
                           <button onClick={() => setEditingLogId(null)} className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-sm shadow-sm transition-colors">Скасувати</button>
                        </div>
                      </div>
                    ) : (
                      <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:shadow-sm transition-all gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${log.type==='OUT' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {log.type === 'OUT' ? <ArrowUpRight className="w-5 h-5"/> : <ArrowDownLeft className="w-5 h-5"/>}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              {log.type === 'OUT' ? 'Відправка товару' : 'Оприбуткування'}
                              {log.orderId && (
                                /^\d{12,14}$/.test(log.orderId.trim())
                                  ? <a href={`https://novaposhta.ua/tracking/${log.orderId.trim()}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 transition-colors" title="Відстежити ТТН">[{log.orderId}] 🔗</a>
                                  : <span className="text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">[{log.orderId}]</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                              <span>{new Date(log.timestamp).toLocaleString('uk-UA')}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>{log.note || 'Без примітки'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex sm:flex-col justify-between items-center sm:items-end gap-2 sm:gap-0">
                          <div className={`text-lg font-extrabold ${log.type==='OUT' ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {log.type === 'OUT' ? '-' : '+'}{log.changeQty} <span className="text-sm">шт</span>
                          </div>

                          {isAdmin && (
                            <div className="flex gap-3 mt-1.5 opacity-50 hover:opacity-100 transition-opacity">
                               <button onClick={() => startEditingLog(log)} className="text-[11px] text-indigo-600 hover:text-indigo-800 uppercase font-extrabold flex items-center gap-1">✎ Редаг.</button>
                               <button onClick={() => handleDeleteLog(log.id)} className="text-[11px] text-rose-500 hover:text-rose-700 uppercase font-extrabold flex items-center gap-1">× Видал.</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
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
