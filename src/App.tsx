import React, { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, doc, getDocs, getDoc, addDoc, updateDoc, 
  query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, writeBatch
} from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { format } from 'date-fns';
import { 
  Package, Plus, QrCode, LogOut, ArrowLeft, 
  AlertTriangle, History, Save, Edit, RefreshCw, Settings
} from 'lucide-react';

// --- Types ---
interface Part {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  safetyStock: number;
  leadTimeDays: number;
  location: string;
  category: string;
  totalIn?: number;
  totalOut?: number;
}

interface InventoryLog {
  id: string;
  partId: string;
  type: 'in' | 'out' | 'adjust' | 'rollover';
  quantity: number;
  reason: string;
  timestamp: any;
  userId: string;
}

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'register' | 'scan' | 'partDetails'>('dashboard');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [firebaseConfigured, setFirebaseConfigured] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFirebaseConfigured(false);
      setLoading(false);
      return;
    }

    // --- [배포 시 수정] 실제 로그인 활성화 ---
    // Netlify 등 실제 배포 시 아래 주석을 해제하고, 임시 테스트용 코드를 삭제하세요.
    /*
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
    */

    // --- [테스트용] 임시 로그인 바이패스 ---
    // 미리보기 환경에서 로그인 에러를 방지하기 위해 가짜 사용자 데이터를 주입합니다.
    setUser({ uid: 'test-admin-uid', email: 'admin@test.com' } as User);
    setLoading(false);
  }, []);

  const handleLogin = async () => {
    // --- [배포 시 수정] 실제 로그인 활성화 ---
    /*
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인에 실패했습니다. Firebase 설정을 확인해주세요.');
    }
    */
  };

  const handleLogout = () => {
    // --- [배포 시 수정] 실제 로그아웃 활성화 ---
    // signOut(auth);
    alert('테스트 모드에서는 로그아웃이 비활성화되어 있습니다.');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">로딩 중...</div>;
  }

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full">
          <div className="flex items-center gap-3 mb-6 text-orange-600">
            <Settings className="w-8 h-8" />
            <h1 className="text-2xl font-bold">Firebase 설정 필요</h1>
          </div>
          
          <div className="space-y-4 text-gray-700">
            <p className="font-medium">앱을 사용하려면 Firebase 연동이 필요합니다.</p>
            <p>AI Studio의 <strong>Secrets</strong> 메뉴(열쇠 아이콘)에서 다음 환경 변수들을 설정해주세요:</p>
            
            <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm space-y-2">
              <div>VITE_FIREBASE_API_KEY</div>
              <div>VITE_FIREBASE_AUTH_DOMAIN</div>
              <div>VITE_FIREBASE_PROJECT_ID</div>
              <div>VITE_FIREBASE_STORAGE_BUCKET</div>
              <div>VITE_FIREBASE_MESSAGING_SENDER_ID</div>
              <div>VITE_FIREBASE_APP_ID</div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm">
              <p className="font-bold mb-1">설정 방법:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Firebase Console (console.firebase.google.com) 접속</li>
                <li>새 프로젝트 생성 및 Firestore, Authentication(Google) 활성화</li>
                <li>웹 앱 추가 후 제공되는 설정값을 위의 환경 변수에 입력</li>
                <li>설정 완료 후 이 페이지를 새로고침하세요.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <Package className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">HVAC 재고 관리 시스템</h1>
          <p className="text-gray-500 mb-8">Google 계정으로 로그인하여 시작하세요</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Google 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setView('dashboard')}
          >
            <Package className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg hidden sm:block">HVAC Inventory</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="로그아웃"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-4 py-8">
        {view === 'dashboard' && (
          <Dashboard 
            onNavigate={(v, id) => { setView(v); if (id) setSelectedPartId(id); }} 
            user={user}
          />
        )}
        {view === 'register' && (
          <RegisterPart onBack={() => setView('dashboard')} />
        )}
        {view === 'scan' && (
          <QRScanner 
            onBack={() => setView('dashboard')} 
            onScan={(id) => { setSelectedPartId(id); setView('partDetails'); }} 
          />
        )}
        {view === 'partDetails' && selectedPartId && (
          <PartDetails 
            partId={selectedPartId} 
            user={user}
            onBack={() => { setView('dashboard'); setSelectedPartId(null); }} 
          />
        )}
      </main>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ onNavigate, user }: { onNavigate: (view: any, id?: string) => void, user: User }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRollingOver, setIsRollingOver] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'parts'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const partsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Part));
      setParts(partsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching parts:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRollover = async () => {
    if (!window.confirm('현재고를 다음 달 기초재고로 이월하시겠습니까?')) return;
    
    setIsRollingOver(true);
    try {
      const nextMonth = format(new Date(new Date().setMonth(new Date().getMonth() + 1)), 'yyyy-MM');
      const batch = writeBatch(db);
      
      parts.forEach(part => {
        // 1. Create monthly snapshot
        const snapshotRef = doc(collection(db, 'monthlySnapshots'));
        batch.set(snapshotRef, {
          month: nextMonth,
          partId: part.id,
          openingStock: part.currentStock,
          timestamp: serverTimestamp()
        });

        // 2. Log rollover
        const logRef = doc(collection(db, 'inventoryLogs'));
        batch.set(logRef, {
          partId: part.id,
          type: 'rollover',
          quantity: part.currentStock,
          reason: `${nextMonth} 기초재고 이월`,
          timestamp: serverTimestamp(),
          userId: user.uid
        });
      });

      await batch.commit();
      alert(`${nextMonth} 기초재고 이월이 완료되었습니다.`);
    } catch (error) {
      console.error('Rollover error:', error);
      alert('이월 처리 중 오류가 발생했습니다.');
    } finally {
      setIsRollingOver(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">데이터를 불러오는 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold text-gray-900">재고 현황</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => onNavigate('scan')}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <QrCode className="w-4 h-4" /> QR 스캔
          </button>
          <button 
            onClick={() => onNavigate('register')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 부품 등록
          </button>
          <button 
            onClick={handleRollover}
            disabled={isRollingOver}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRollingOver ? 'animate-spin' : ''}`} /> 
            월말 마감 및 이월
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">부품명 (SKU)</th>
                <th className="px-6 py-4 font-medium">위치</th>
                <th className="px-6 py-4 font-medium text-right">총 입고</th>
                <th className="px-6 py-4 font-medium text-right">총 출고</th>
                <th className="px-6 py-4 font-medium text-right">잔고(현재고)</th>
                <th className="px-6 py-4 font-medium text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    등록된 부품이 없습니다.
                  </td>
                </tr>
              ) : (
                parts.map(part => {
                  const isLowStock = part.currentStock < (part.safetyStock * 0.15); // 15% 미만
                  return (
                    <tr 
                      key={part.id} 
                      onClick={() => onNavigate('partDetails', part.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{part.name}</div>
                        <div className="text-xs text-gray-500">{part.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{part.location}</td>
                      <td className="px-6 py-4 text-right font-mono text-green-600">{part.totalIn || 0}</td>
                      <td className="px-6 py-4 text-right font-mono text-blue-600">{part.totalOut || 0}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">{part.currentStock}</td>
                      <td className="px-6 py-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3" /> 위험
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            정상
                          </span>
                        )}
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
  );
}

// --- Register Part Component ---
function RegisterPart({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState({
    name: '', sku: '', currentStock: 0, safetyStock: 0, leadTimeDays: 0, location: '', category: ''
  });
  const [saving, setSaving] = useState(false);
  const [generatedId, setGeneratedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'parts'), {
        ...formData,
        currentStock: Number(formData.currentStock),
        safetyStock: Number(formData.safetyStock),
        leadTimeDays: Number(formData.leadTimeDays),
        totalIn: Number(formData.currentStock), // 기초 재고를 최초 입고로 처리
        totalOut: 0
      });
      setGeneratedId(docRef.id);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> 돌아가기
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">새 부품 등록</h2>
        
        {generatedId ? (
          <div className="text-center py-8">
            <div className="inline-block p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl mb-6">
              {/* 70x42mm Label Preview (approximate ratio) */}
              <div className="w-[264px] h-[158px] border border-gray-200 p-4 flex items-center gap-4 bg-white">
                <QRCodeSVG value={generatedId} size={100} />
                <div className="text-left flex-1 overflow-hidden">
                  <div className="font-bold text-sm truncate">{formData.name}</div>
                  <div className="text-xs text-gray-500 truncate mb-2">SKU: {formData.sku}</div>
                  <div className="text-xs">Loc: {formData.location}</div>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-medium text-green-600 mb-2">등록이 완료되었습니다!</h3>
            <p className="text-gray-500 mb-8">위 QR 코드를 라벨 프린터(70x42mm)로 출력하여 부품에 부착하세요.</p>
            <button 
              onClick={onBack}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부품명</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU (품번)</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">보관 위치</label>
                <input required type="text" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기초 재고</label>
                <input required type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.currentStock} onChange={e => setFormData({...formData, currentStock: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">안전 재고</label>
                <input required type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.safetyStock} onChange={e => setFormData({...formData, safetyStock: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">리드타임 (일)</label>
                <input required type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2.5" 
                  value={formData.leadTimeDays} onChange={e => setFormData({...formData, leadTimeDays: Number(e.target.value)})} />
              </div>
            </div>
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={saving}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {saving ? '저장 중...' : <><Save className="w-5 h-5" /> 부품 등록 및 QR 생성</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- QR Scanner Component ---
function QRScanner({ onBack, onScan }: { onBack: () => void, onScan: (id: string) => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      (error) => {
        // Ignore scan errors (happens continuously until a QR is found)
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScan]);

  return (
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> 돌아가기
      </button>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-center mb-4">QR 코드 스캔</h2>
        <div id="reader" className="w-full overflow-hidden rounded-lg"></div>
        <p className="text-center text-sm text-gray-500 mt-4">
          부품에 부착된 QR 코드를 카메라 중앙에 맞춰주세요.
        </p>
      </div>
    </div>
  );
}

// --- Part Details Component ---
function PartDetails({ partId, user, onBack }: { partId: string, user: User, onBack: () => void }) {
  const [part, setPart] = useState<Part | null>(null);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustData, setAdjustData] = useState({ type: 'in', quantity: 0, reason: '' });

  useEffect(() => {
    const partRef = doc(db, 'parts', partId);
    const unsubPart = onSnapshot(partRef, (docSnap) => {
      if (docSnap.exists()) {
        setPart({ id: docSnap.id, ...docSnap.data() } as Part);
      } else {
        alert('존재하지 않는 부품입니다.');
        onBack();
      }
      setLoading(false);
    });

    const logsQuery = query(
      collection(db, 'inventoryLogs'), 
      where('partId', '==', partId),
      orderBy('timestamp', 'desc')
    );
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog)));
    });

    return () => { unsubPart(); unsubLogs(); };
  }, [partId, onBack]);

  const handleTransaction = async (type: 'in' | 'out') => {
    if (!part) return;
    const qtyStr = prompt(`얼마나 ${type === 'in' ? '입고' : '출고'}하시겠습니까?`);
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return alert('올바른 수량을 입력하세요.');
    
    if (type === 'out' && part.currentStock < qty) {
      return alert('현재고가 부족합니다.');
    }

    const newStock = type === 'in' ? part.currentStock + qty : part.currentStock - qty;
    const newTotalIn = type === 'in' ? (part.totalIn || 0) + qty : (part.totalIn || 0);
    const newTotalOut = type === 'out' ? (part.totalOut || 0) + qty : (part.totalOut || 0);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'parts', part.id), { 
        currentStock: newStock,
        totalIn: newTotalIn,
        totalOut: newTotalOut
      });
      batch.set(doc(collection(db, 'inventoryLogs')), {
        partId: part.id,
        type,
        quantity: qty,
        reason: type === 'in' ? '일반 입고' : '일반 출고',
        timestamp: serverTimestamp(),
        userId: user.uid
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!part) return;
    if (adjustData.quantity <= 0) return alert('수량은 1 이상이어야 합니다.');
    if (!adjustData.reason) return alert('사유를 입력해주세요.');

    const newStock = adjustData.type === 'in' 
      ? part.currentStock + adjustData.quantity 
      : part.currentStock - adjustData.quantity;

    const newTotalIn = adjustData.type === 'in' ? (part.totalIn || 0) + adjustData.quantity : (part.totalIn || 0);
    const newTotalOut = adjustData.type === 'out' ? (part.totalOut || 0) + adjustData.quantity : (part.totalOut || 0);

    if (newStock < 0) return alert('재고는 0 미만이 될 수 없습니다.');

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'parts', part.id), { 
        currentStock: newStock,
        totalIn: newTotalIn,
        totalOut: newTotalOut
      });
      batch.set(doc(collection(db, 'inventoryLogs')), {
        partId: part.id,
        type: 'adjust',
        quantity: adjustData.type === 'in' ? adjustData.quantity : -adjustData.quantity,
        reason: adjustData.reason,
        timestamp: serverTimestamp(),
        userId: user.uid
      });
      await batch.commit();
      setShowAdjustModal(false);
      setAdjustData({ type: 'in', quantity: 0, reason: '' });
    } catch (error) {
      console.error(error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  if (loading || !part) return <div className="text-center py-12">로딩 중...</div>;

  const isLowStock = part.currentStock < (part.safetyStock * 0.15);
  const reorderDate = new Date();
  reorderDate.setDate(reorderDate.getDate() + part.leadTimeDays);

  // 수불부(Ledger) 계산을 위해 잔고 역산
  let currentBalance = part.currentStock;
  const logsWithBalance = logs.map(log => {
    const balance = currentBalance;
    let change = 0;
    if (log.type === 'in') change = log.quantity;
    else if (log.type === 'out') change = -log.quantity;
    else if (log.type === 'adjust') change = log.quantity; // adjust quantity is signed
    
    currentBalance -= change; // 역산 (이전 잔고 구하기)
    return { ...log, balance };
  });

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4" /> 목록으로 돌아가기
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Details */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{part.name}</h2>
            <p className="text-gray-500 text-sm mb-6">SKU: {part.sku}</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">현재고</span>
                <span className={`text-2xl font-mono font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                  {part.currentStock}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">안전재고</span>
                <span className="font-mono text-gray-900">{part.safetyStock}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">리드타임</span>
                <span className="text-gray-900">{part.leadTimeDays}일</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500 text-sm">위치</span>
                <span className="text-gray-900">{part.location}</span>
              </div>
            </div>

            {isLowStock && (
              <div className="mt-6 bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-800">재고 부족 경고</h4>
                  <p className="text-xs text-red-600 mt-1">
                    현재고가 안전재고의 15% 미만입니다. 발주가 필요합니다.
                    (예상 입고일: {format(reorderDate, 'yyyy-MM-dd')})
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">빠른 작업</h3>
            <div className="space-y-3">
              <button 
                onClick={() => handleTransaction('in')}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                입고 처리 (+)
              </button>
              <button 
                onClick={() => handleTransaction('out')}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                출고 처리 (-)
              </button>
              <button 
                onClick={() => setShowAdjustModal(true)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" /> 재고 조정 (로스/파손)
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: History */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
            <div className="flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-900 text-lg">재고 이력</h3>
            </div>
            
            <div className="space-y-4">
              {logsWithBalance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">이력이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">일시</th>
                        <th className="px-4 py-3 font-medium">구분/사유</th>
                        <th className="px-4 py-3 font-medium text-right">입고</th>
                        <th className="px-4 py-3 font-medium text-right">출고</th>
                        <th className="px-4 py-3 font-medium text-right">잔고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {logsWithBalance.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {log.timestamp ? format(log.timestamp.toDate(), 'MM-dd HH:mm') : '방금 전'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase whitespace-nowrap ${
                                log.type === 'in' ? 'bg-green-100 text-green-800' :
                                log.type === 'out' ? 'bg-blue-100 text-blue-800' :
                                log.type === 'rollover' ? 'bg-purple-100 text-purple-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {log.type}
                              </span>
                              <span className="text-gray-900 line-clamp-1">{log.reason}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-green-600">
                            {log.type === 'in' || (log.type === 'adjust' && log.quantity > 0) ? Math.abs(log.quantity) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-blue-600">
                            {log.type === 'out' || (log.type === 'adjust' && log.quantity < 0) ? Math.abs(log.quantity) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">
                            {log.balance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">재고 조정</h3>
            <form onSubmit={handleAdjustment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">조정 유형</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5"
                  value={adjustData.type}
                  onChange={e => setAdjustData({...adjustData, type: e.target.value})}
                >
                  <option value="in">증가 (+)</option>
                  <option value="out">감소 (-)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
                <input 
                  type="number" min="1" required
                  className="w-full border border-gray-300 rounded-lg p-2.5"
                  value={adjustData.quantity || ''}
                  onChange={e => setAdjustData({...adjustData, quantity: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사유 (파손, 분실, 실사 등)</label>
                <input 
                  type="text" required
                  className="w-full border border-gray-300 rounded-lg p-2.5"
                  value={adjustData.reason}
                  onChange={e => setAdjustData({...adjustData, reason: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" onClick={() => setShowAdjustModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  조정 적용
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
