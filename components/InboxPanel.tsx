
import React, { useState, useEffect } from 'react';
import { NotifikasiMessage } from '../types';
import { useStore } from '../store/useStore';
import { db, ensureFirebaseAuth } from '../services/firebaseService';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { Bell, CheckCircle2, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';

const InboxPanel: React.FC = () => {
  const { user, isInboxOpen: isOpen, setIsInboxOpen: onClose } = useStore();
  const themeColor = useStore(state => state.getThemeColor());
  const [messages, setMessages] = useState<NotifikasiMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !isOpen) return;

    let unsubId: (() => void) | undefined;
    let unsubRole: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const authOk = await ensureFirebaseAuth();
      if (!authOk || !isMounted) {
        if (!authOk) console.error("Skipping inbox listener: Auth failed");
        return;
      }
      
      // Query for messages where receiverId is user.id OR receiverRole is user.role
      const q = query(
        collection(db, "notifications"),
        where("receiverId", "in", [user.id, "ALL"]), // "ALL" for broadcast if needed
        orderBy("createdAt", "desc"),
        limit(50)
      );

      // We also need to listen for role-based notifications
      const qRole = query(
        collection(db, "notifications"),
        where("receiverRole", "==", user.role),
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubId = onSnapshot(q, (snapshot) => {
        const idMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotifikasiMessage));
        setMessages(prev => {
          const combined = [...idMsgs, ...prev.filter(m => m.receiverRole === user.role)];
          // Unique by ID
          return Array.from(new Map(combined.map(m => [m.id, m])).values())
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        });
        setLoading(false);
      }, (error) => {
        console.warn("Inbox Listener (ID) Error:", error);
        setLoading(false);
      });

      unsubRole = onSnapshot(qRole, (snapshot) => {
        const roleMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotifikasiMessage));
        setMessages(prev => {
          const combined = [...roleMsgs, ...prev.filter(m => m.receiverId === user.id)];
          return Array.from(new Map(combined.map(m => [m.id, m])).values())
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        });
        setLoading(false);
      }, (error) => {
        console.warn("Inbox Listener (Role) Error:", error);
        setLoading(false);
      });
    };

    setupListener();

    return () => {
      isMounted = false;
      if (unsubId) unsubId();
      if (unsubRole) unsubRole();
    };
  }, [user?.id, user?.role, isOpen]);

  const handleMarkAsRead = async (msg: NotifikasiMessage) => {
    if (msg.status === 'BELUM LIHAT') {
      try {
        const docRef = doc(db, "notifications", msg.id);
        await updateDoc(docRef, { status: 'TELAH LIHAT' });
      } catch (e) {
        console.error("Error marking as read:", e);
      }
    }
  };

  const handleAcknowledge = async (msg: NotifikasiMessage) => {
    try {
      const docRef = doc(db, "notifications", msg.id);
      await updateDoc(docRef, { status: 'DISAHKAN' });

      // Auto-reply to sender
      await addDoc(collection(db, "notifications"), {
        appId: msg.appId,
        syarikat: msg.syarikat,
        senderId: user.id,
        senderName: user.name,
        receiverId: msg.senderId,
        message: `PENGESAHAN: Permohonan ${msg.syarikat} telah diterima dan disahkan oleh ${user.name}.`,
        status: 'BELUM LIHAT',
        type_kes: msg.type_kes,
        createdAt: serverTimestamp()
      });

      toast.success("Penerimaan disahkan!");
    } catch (e) {
      console.error("Error acknowledging:", e);
      toast.error("Gagal mengesahkan penerimaan.");
    }
  };

  if (!isOpen) return null;

  const accentBg = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    orange: 'bg-orange-500',
    indigo: 'bg-indigo-600',
    rose: 'bg-rose-600',
    pink: 'bg-pink-600',
    purple: 'bg-purple-600',
    yellow: 'bg-yellow-500',
  }[themeColor] || 'bg-blue-600';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end items-start p-4 pt-20 pointer-events-none">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 pointer-events-auto flex flex-col max-h-[80vh] animate-in slide-in-from-right-4 duration-300">
        <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${accentBg} text-white rounded-t-3xl`}>
          <div className="flex items-center gap-3">
            <Bell size={24} />
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Peti Masuk (Inbox)</h2>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Notifikasi & Maklum Balas</p>
            </div>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuatkan Mesej...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center">
              <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tiada Notifikasi Baharu</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => handleMarkAsRead(msg)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  msg.status === 'BELUM LIHAT' ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-white border-slate-100 opacity-70'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    msg.type_kes === 'PEMUTIHAN' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {msg.type_kes}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">
                    {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleString() : 'Baru'}
                  </span>
                </div>
                
                <h4 className="text-xs font-black text-slate-800 uppercase mb-1">{msg.syarikat}</h4>
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed mb-3">{msg.message}</p>
                
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Dihantar Oleh: {msg.senderName}</p>
                  
                  <div className="flex gap-2">
                    {msg.status !== 'DISAHKAN' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAcknowledge(msg); }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${accentBg} text-white shadow-sm hover:scale-105`}
                      >
                        <CheckCircle2 size={12} /> Sahkan Terima
                      </button>
                    )}
                    {msg.status === 'DISAHKAN' && (
                      <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-black uppercase">
                        <CheckCircle2 size={12} /> Disahkan
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxPanel;
