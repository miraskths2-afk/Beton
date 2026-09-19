import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Ban, Trash2, Loader2, Phone } from "lucide-react";

export default function BlacklistManager() {
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

  if (loading) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <Ban className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Список пуст</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div
          key={b.id}
          className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-neutral-900 truncate">
                {b.phone}
              </div>
              {b.reason && (
                <div className="text-xs text-neutral-500 truncate">{b.reason}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => remove(b.id)}
            className="shrink-0 px-3 py-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
