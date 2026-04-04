// ═══════════════════════════════════════════════════════════════
// DealClarity Phase 2.2: Cloud Deal Sync for Pro Users
// Pro users → Supabase (synced across devices)
// Free users → localStorage (2 deal limit)
// ═══════════════════════════════════════════════════════════════
import { supabase } from "../supabase";

// Fetch all deals for the current user from Supabase
export async function fetchCloudDeals() {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchCloudDeals error:", error.message);
    return [];
  }

  // Transform Supabase rows into the app's portfolio format
  return (data || []).map((row) => ({
    id: row.id,
    type: row.deal_type,
    data: row.inputs || {},
    calc: row.results || {},
    name: row.name || "",
    cloudId: row.id, // Track that this deal is synced
    createdAt: row.created_at,
  }));
}

// Save a single deal to Supabase
export async function saveCloudDeal(deal, userId) {
  const payload = {
    user_id: userId,
    deal_type: deal.type,
    name: deal.data?.dealName || deal.name || "",
    inputs: deal.data || {},
    results: deal.calc || {},
    score: deal.calc?.score || 0,
    grade: deal.calc?.grade || "",
  };

  // If this deal already has a cloud ID, update it
  if (deal.cloudId) {
    const { data, error } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", deal.cloudId)
      .select()
      .single();

    if (error) {
      console.error("updateCloudDeal error:", error.message);
      return null;
    }
    return data;
  }

  // Otherwise insert new
  const { data, error } = await supabase
    .from("deals")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("saveCloudDeal error:", error.message);
    return null;
  }
  return data;
}

// Delete a deal from Supabase
export async function deleteCloudDeal(cloudId) {
  if (!cloudId) return;
  const { error } = await supabase.from("deals").delete().eq("id", cloudId);
  if (error) {
    console.error("deleteCloudDeal error:", error.message);
  }
}

// Merge local deals into cloud on first Pro login
// Avoids duplicates by checking if deal inputs match
export async function mergeLocalToCloud(localDeals, userId) {
  const cloudDeals = await fetchCloudDeals();
  const merged = [];
  let newUploads = 0;

  for (const local of localDeals) {
    // Check if this deal already exists in cloud (by matching type + key inputs)
    const isDuplicate = cloudDeals.some(
      (cloud) =>
        cloud.type === local.type &&
        JSON.stringify(cloud.data) === JSON.stringify(local.data)
    );

    if (!isDuplicate) {
      const saved = await saveCloudDeal(local, userId);
      if (saved) {
        merged.push({
          ...local,
          id: saved.id,
          cloudId: saved.id,
        });
        newUploads++;
      }
    }
  }

  // Return the full cloud portfolio (existing + newly merged)
  const finalDeals = await fetchCloudDeals();
  return { deals: finalDeals, newUploads };
}
