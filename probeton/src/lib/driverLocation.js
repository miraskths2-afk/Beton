import { supabase } from "@/api/base44Client";

const TABLE = "driver_locations";

export async function upsertMyLocation(driverId, driverName, lat, lng) {
  const { error } = await supabase.from(TABLE).upsert({
    driver_id: driverId,
    driver_name: driverName,
    lat,
    lng,
    is_online: true,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("upsertMyLocation error", error);
}

export async function setOffline(driverId) {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_online: false })
    .eq("driver_id", driverId);
  if (error) console.error("setOffline error", error);
}

export async function fetchLocations(driverIds) {
  let query = supabase.from(TABLE).select("*").eq("is_online", true);
  if (driverIds && driverIds.length) {
    query = query.in("driver_id", driverIds);
  }
  const { data, error } = await query;
  if (error) {
    console.error("fetchLocations error", error);
    return [];
  }
  return data || [];
}

export function subscribeToLocations(callback) {
  const channel = supabase
    .channel(`realtime:driver_locations:${Math.random()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE },
      callback
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
