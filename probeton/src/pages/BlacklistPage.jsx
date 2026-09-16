import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Ban, Trash2, Loader2, Phone } from "lucide-react";

export default function BlacklistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const all = await base44.entities.Blacklist.list("-created_date", 200);
      setItems(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsub = base44.entities.Blacklist.subscribe(() => load());
    return unsub;
  }, []);

  const remove = async (id) => {
    try {
      await base44.entities.Blacklist.delete(id);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="px-1">
        <h1 className="text-xl font-black text-neutral-900 flex items-center gap-2">
          <Ban className="w-5 h-5 text-red-500" />
          Чёрный список
        </h1>
        <p className="text-sm text-neutral-500">
          Заблокированные номера по всей экосистеме
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-neutral-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <Ban className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Список пуст</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl p-3 border border-neutral-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-neutral-400" />
                <div>
                  <div className="text-sm font-bold text-neutral-900">
                    {b.phone}
                  </div>
                  {b.reason && (
                    <div className="text-xs text-neutral-500">{b.reason}</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(b.id)}
                className="px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
