/* ========================================
   NEO-ROBO - Player Registry (v4)
   Cloud-first: Supabase is the source of truth.
   LocalStorage only caches the current player name.
   ======================================== */

// ─── SUPABASE SETUP ───
// ⚠️ REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL  = 'https://nvecxhclbdyywtostvdi.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_BiVeODTGouKI25dJGhN5vQ_-pRqOHTS';
const TABLE_NAME    = 'players';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const PlayerRegistry = {
    currentPlayer: null,

    _key(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
        return trimmed.length > 0 ? trimmed.toLowerCase() : null;
    },

    _load() {
        try {
            return JSON.parse(localStorage.getItem('neo_robo_players')) || [];
        } catch (e) {
            return [];
        }
    },

    _save(list) {
        localStorage.setItem('neo_robo_players', JSON.stringify(list));
    },

    loadCurrent() {
        try {
            return localStorage.getItem('neo_robo_current_player');
        } catch (e) {
            return null;
        }
    },

    saveCurrent(name) {
        localStorage.setItem('neo_robo_current_player', name);
        this.currentPlayer = name;
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

    register(name) {
        const k = this._key(name);
        if (!k) return { ok: false, error: 'Name cannot be empty.' };
        if (name.trim().length > 16) return { ok: false, error: 'Max 16 characters.' };

        this.saveCurrent(name.trim());

        const newPlayer = {
            name: name.trim(),
            high_score: 0,
            last_score: 0,
            plays: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        this._upsertToSupabase(newPlayer)
            .then(() => console.log('Player registered in cloud:', name.trim()))
            .catch(err => console.error('Supabase registration failed:', err));

        const list = this._load();
        const idx = list.findIndex(p => (p.name || '').toLowerCase() === k);
        if (idx === -1) {
            list.push(newPlayer);
        }
        this._save(list);

        return { ok: true, player: newPlayer };
    },

    exists(name) {
        const k = this._key(name);
        if (!k) return false;
        const list = this._load();
        return list.some(p => (p.name || '').toLowerCase() === k);
    },

    recordScore(name, score) {
        const k = this._key(name);
        if (!k) return;

        const list = this._load();
        const idx = list.findIndex(p => (p.name || '').toLowerCase() === k);

        let player;
        if (idx === -1) {
            player = {
                name: name.trim(),
                high_score: score,
                last_score: score,
                plays: 1,
                created_at: Date.now(),
                updated_at: Date.now()
            };
            list.push(player);
        } else {
            player = list[idx];
            player.last_score = score;
            player.plays = (player.plays || 0) + 1;
            if (score > (player.high_score || 0)) player.high_score = score;
            player.updated_at = Date.now();
            list[idx] = player;
        }
        this._save(list);

        const cloudPlayer = {
            name: player.name,
            high_score: player.high_score,
            last_score: player.last_score,
            plays: player.plays,
            created_at: new Date(player.created_at).toISOString(),
            updated_at: new Date().toISOString()
        };

        this._upsertToSupabase(cloudPlayer)
            .then(() => console.log('Score synced to Supabase for', player.name))
            .catch(err => console.error('Score sync failed:', err));
    },

    async getRanked() {
        try {
            const rows = await this._fetchLeaderboardFromSupabase();
            const ranked = rows.map((p, i) => ({
                rank: i + 1,
                name: p.name,
                highScore: p.high_score,
                lastScore: p.last_score,
                plays: p.plays || 1
            }));
            this._save(rows);
            return ranked;
        } catch (err) {
            console.error('Failed to fetch global leaderboard, falling back to local:', err);
            const list = this._load();
            const sorted = [...list].sort((a, b) => (b.high_score || 0) - (a.high_score || 0));
            return sorted.map((p, i) => ({
                rank: i + 1,
                name: p.name,
                highScore: p.high_score || 0,
                lastScore: p.last_score || 0,
                plays: p.plays || 1
            }));
        }
    },

    async syncWithSupabase() {
        return this.getRanked();
    }
};