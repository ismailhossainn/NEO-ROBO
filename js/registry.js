/* ========================================
   NEO-ROBO - Player Registry (v5)
   LEGACY REGISTER FLOW REMOVED.
   Player names are now auto-generated (anonymous pilot ID) and used
   silently for the cloud leaderboard. No registration UI, no manual
   entry, and the register screen has been deleted from the HTML.
   ======================================== */

// ─── SUPABASE SETUP (still used for the global leaderboard) ───
const SUPABASE_URL  = 'https://nvecxhclbdyywtostvdi.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_BiVeODTGouKI25dJGhN5vQ_-pRqOHTS';
const TABLE_NAME    = 'players';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PlayerRegistry = {
    currentPlayer: null,

    /**
     * Returns (and lazily creates) an anonymous pilot ID for this device.
     * Replaces the old manual registration flow entirely.
     */
    ensureAnonymousPilot() {
        if (this.currentPlayer) return this.currentPlayer;
        let name = null;
        try {
            name = localStorage.getItem('neo_robo_current_player');
        } catch (e) { name = null; }
        if (!name || typeof name !== 'string' || !name.trim()) {
            const id = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
            name = 'PILOT-' + id;
            try { localStorage.setItem('neo_robo_current_player', name); } catch (e) {}
        }
        this.currentPlayer = name;
        return name;
    },

    async _upsertToSupabase(playerObj) {
        const { error } = await supabase
            .from(TABLE_NAME)
            .upsert(playerObj, { onConflict: 'name' });
        if (error) throw error;
    },

    async _fetchLeaderboardFromSupabase() {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('name, high_score, last_score, plays, created_at, updated_at')
            .order('high_score', { ascending: false })
            .limit(100);
        if (error) throw error;
        return data || [];
    },

    recordScore(name, score) {
        if (!name) name = this.ensureAnonymousPilot();
        const cloudPlayer = {
            name: name,
            high_score: score,
            last_score: score,
            plays: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        // Best-effort cloud sync, do not block gameplay.
        this._upsertToSupabase(cloudPlayer)
            .then(() => console.log('Score synced to Supabase for', name))
            .catch(err => console.error('Score sync failed:', err));
    },

    async getRanked() {
        try {
            const rows = await this._fetchLeaderboardFromSupabase();
            return rows.map((p, i) => ({
                rank: i + 1,
                name: p.name,
                highScore: p.high_score,
                lastScore: p.last_score,
                plays: p.plays || 1
            }));
        } catch (err) {
            console.error('Failed to fetch global leaderboard:', err);
            return [];
        }
    }
};

// Pre-warm the anonymous pilot ID as soon as the script loads.
try { PlayerRegistry.ensureAnonymousPilot(); } catch (e) {}
