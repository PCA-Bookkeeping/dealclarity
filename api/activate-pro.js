import { createClient } from "@supabase/supabase-js";

// Pro codes live server-side only — never exposed to the browser
const VALID_CODES = (process.env.PRO_CODES || "").split(",").map(c => c.trim()).filter(Boolean);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { code, email } = body;

    if (!code || !email) {
      return res.status(400).json({ error: "Code and email are required." });
    }

    // Validate the code server-side
    if (!VALID_CODES.includes(code.trim())) {
      return res.status(400).json({ error: "Invalid code. Please check and try again." });
    }

    // Look up user by email
    const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("activate-pro: Failed to list users:", listError.message);
      return res.status(500).json({ error: "Server error. Please try again." });
    }

    const user = userData?.users?.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ error: "No account found for this email. Please sign in first." });
    }

    // Activate Pro in Supabase
    const { error: updateError } = await supabase.from("profiles").update({
      is_pro: true,
      pro_type: "code",
    }).eq("id", user.id);

    if (updateError) {
      console.error("activate-pro: Failed to update profile:", updateError.message);
      return res.status(500).json({ error: "Failed to activate. Please try again." });
    }

    res.json({ success: true, message: "Pro activated!" });
  } catch (err) {
    console.error("activate-pro error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}
