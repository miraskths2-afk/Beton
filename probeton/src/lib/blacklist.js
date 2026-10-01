import { base44 } from "@/api/base44Client";

const norm = (p) => (p || "").replace(/\D/g, "").slice(-10);

export async function isBlacklisted(phone) {
  const num = norm(phone);
  if (!num) return false;
  try {
    const all = await base44.entities.Blacklist.list();
    return all.some((b) => norm(b.phone) === num);
  } catch (e) {
    return false;
  }
}
