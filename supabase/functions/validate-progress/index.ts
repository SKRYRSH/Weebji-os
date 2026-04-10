import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_XP_PER_PUSH  = 600;  // generous — full study session worth
const MAX_LEVEL        = 100;
const MAX_STREAK_DAYS  = 3650; // 10 years
const MAX_GHOST_TOKENS = 60;
const MAX_GHOST_REFILL = 5;    // monthly WEEBJI+ refill

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response('Unauthorized', { status: 401 });

    const body = await req.json();
    const inc = body.progress;
    const lb  = body.leaderboard;
    if (!inc) return new Response('Missing progress', { status: 400 });

    // Get current DB state to validate against
    const { data: cur } = await supabase
      .from('progress')
      .select('level,xp,streak,best_streak,ghost_tokens,total_study_mins,total_workout_days,hp,updated_at')
      .eq('user_id', user.id)
      .single();

    // Rate limit: reject pushes faster than 5s (blocks scripted grinding)
    if (cur?.updated_at) {
      const msSinceLast = Date.now() - new Date(cur.updated_at).getTime();
      if (msSinceLast < 5000) {
        return new Response(JSON.stringify({ ok: true, violations: ['rate_limited'] }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    const violations: string[] = [];

    // Sanitise all incoming values
    const level       = clamp(parseInt(inc.level)        || 1, 1, MAX_LEVEL);
    const xp          = clamp(parseInt(inc.xp)           || 0, 0, 999999);
    const hp          = clamp(parseInt(inc.hp)           || 3, 0, 5);
    const streak      = clamp(parseInt(inc.streak)       || 0, 0, MAX_STREAK_DAYS);
    const bestStreak  = clamp(parseInt(inc.best_streak)  || 0, 0, MAX_STREAK_DAYS);
    const ghostTokens = clamp(parseInt(inc.ghost_tokens) || 0, 0, MAX_GHOST_TOKENS);
    const studyMins   = Math.max(parseInt(inc.total_study_mins)   || 0, 0);
    const workoutDays = Math.max(parseInt(inc.total_workout_days) || 0, 0);

    let vLevel = level, vXp = xp, vStreak = streak, vBest = bestStreak;
    let vGhost = ghostTokens, vStudy = studyMins, vWorkout = workoutDays;

    if (cur) {
      const cL = cur.level || 1;
      const cX = cur.xp   || 0;
      const cS = cur.streak || 0;

      // Level: max +1 per push, never decrease
      if (level > cL + 1) { violations.push('level_jump'); vLevel = cL + 1; }
      vLevel = Math.max(vLevel, cL);

      // XP: cap gain per push (reset to 0 on level-up is fine)
      if (level <= cL && xp > cX + MAX_XP_PER_PUSH) {
        violations.push('xp_jump');
        vXp = cX + MAX_XP_PER_PUSH;
      }

      // Streak: max +1 per push, can drop to 0
      if (streak > cS + 1) { violations.push('streak_jump'); vStreak = cS + 1; }

      // Best streak / study / workout: only ever increase
      vBest    = Math.max(bestStreak, cur.best_streak      || 0);
      vStudy   = Math.max(studyMins,  cur.total_study_mins  || 0);
      vWorkout = Math.max(workoutDays,cur.total_workout_days|| 0);

      // Ghost tokens: decrease freely (spending), increase by max refill
      const cG = cur.ghost_tokens || 0;
      if (ghostTokens > cG + MAX_GHOST_REFILL) {
        violations.push('ghost_jump');
        vGhost = cG + MAX_GHOST_REFILL;
      }
    }

    // Sanitise data blob — cap customWorkouts server-side (M11)
    const safeData = inc.data || {};
    if (Array.isArray(safeData.customWorkouts) && safeData.customWorkouts.length > 20) {
      safeData.customWorkouts = safeData.customWorkouts.slice(0, 20);
    }

    // Write validated progress
    const { error: writeErr } = await supabase.from('progress').upsert({
      user_id:            user.id,
      level:              vLevel,
      xp:                 vXp,
      hp,
      streak:             vStreak,
      best_streak:        vBest,
      ghost_tokens:       vGhost,
      total_study_mins:   vStudy,
      total_workout_days: vWorkout,
      data:               safeData,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (writeErr) throw writeErr;

    // Write leaderboard if included
    if (lb) {
      await supabase.from('leaderboard').upsert({
        ...lb,
        user_id:    user.id,
        level:      vLevel,
        streak:     vStreak,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return new Response(
      JSON.stringify({ ok: true, violations }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
