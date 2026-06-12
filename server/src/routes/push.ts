import { Router } from "express";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

const ready =
  Boolean(supabaseUrl) &&
  Boolean(serviceRoleKey) &&
  Boolean(vapidPublic) &&
  Boolean(vapidPrivate);

if (ready) {
  webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
}

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// POST /api/push/subscribe — upsert a push subscription for a member
router.post("/subscribe", async (req, res) => {
  if (!ready) return res.status(503).json({ error: "Push not configured" });
  const { subscription, memberId, roomId } = req.body as {
    subscription: { endpoint: string; keys?: Record<string, string>; [k: string]: unknown };
    memberId: string;
    roomId: string;
  };
  if (!subscription?.endpoint || !memberId || !roomId) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const sb = getSupabase()!;
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      member_id: memberId,
      room_id: roomId,
      endpoint: subscription.endpoint,
      subscription: subscription,
    },
    { onConflict: "member_id" }
  );
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// DELETE /api/push/subscribe — remove a push subscription
router.delete("/subscribe", async (req, res) => {
  const { memberId } = req.body as { memberId: string };
  if (!memberId) return res.status(400).json({ error: "Missing memberId" });
  const sb = getSupabase();
  if (!sb) return res.status(503).json({ error: "Push not configured" });
  await sb.from("push_subscriptions").delete().eq("member_id", memberId);
  return res.json({ ok: true });
});

// POST /api/push/notify — fan-out to all room members except the actor
router.post("/notify", async (req, res) => {
  if (!ready) return res.status(503).json({ error: "Push not configured" });
  const { roomId, actorId, title, body, tag } = req.body as {
    roomId: string;
    actorId: string;
    title: string;
    body: string;
    tag?: string;
  };
  if (!roomId || !actorId || !title) {
    return res.status(400).json({ error: "Missing fields" });
  }
  const sb = getSupabase()!;
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("subscription")
    .eq("room_id", roomId)
    .neq("member_id", actorId);

  if (error) return res.status(500).json({ error: error.message });
  if (!subs?.length) return res.json({ sent: 0 });

  const payload = JSON.stringify({ title, body, tag: tag ?? "rp", url: "/" });
  const results = await Promise.allSettled(
    subs.map((row) =>
      webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;

  // Clean up expired/invalid subscriptions (410 Gone)
  const expired = results
    .map((r, i) => ({ r, sub: subs[i] }))
    .filter(
      ({ r }) =>
        r.status === "rejected" &&
        (r as PromiseRejectedResult).reason?.statusCode === 410
    )
    .map(({ sub }) => (sub.subscription as { endpoint: string }).endpoint);

  if (expired.length) {
    await sb
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }

  return res.json({ sent });
});

// POST /api/push/test — send a test notification to the requesting member only
router.post("/test", async (req, res) => {
  if (!ready) return res.status(503).json({ error: "Push not configured" });
  const { memberId } = req.body as { memberId: string };
  if (!memberId) return res.status(400).json({ error: "Missing memberId" });
  const sb = getSupabase()!;
  const { data } = await sb
    .from("push_subscriptions")
    .select("subscription")
    .eq("member_id", memberId)
    .maybeSingle();

  if (!data) return res.status(404).json({ error: "No subscription found" });

  await webpush.sendNotification(
    data.subscription as webpush.PushSubscription,
    JSON.stringify({
      title: "Restaurant Planner",
      body: "Push notifications are working!",
      tag: "rp-test",
      url: "/",
    })
  );
  return res.json({ ok: true });
});

export function pushRouter() {
  return router;
}
