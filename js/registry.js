/* ========================================
   NEO-ROBO - Player Registry & Scoreboard
   Stores registered pilots and their scores
   in localStorage & Supabase Database.
   ======================================== */

// ---------- Supabase Configuration ----------
const SUPABASE_URL = "https://nvecxhclbdyywtostvdi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BiVeODTGouKI25dJGhN5vQ_-pRqOHTS";

// Initialize the Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase initialized successfully!");

const PlayerRegistry = {
    STORAGE_KEY: 'neoRoboPlayers',
    CURRENT_KEY: 'neoRoboCurrentPlayer',
    currentPlayer: null,

    // ---------- Storage helpers ----------
    _load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    },

    _save(list) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
        } catch (e) {}
    },

    // ---------- Name validation / normalization ----------
    normalize(name) {
        return (name || '').trim();
    },

    _key(name) {
        // Case-insensitive duplicate check
        return this.normalize(name).toLowerCase();
    },

    // ---------- Public API ----------
    getAll() {
        return this._load();
    },

    exists(name) {
        const k = this._key(name);
        if (!k) return false;
        return this._load().some(p => (p.name || '').toLowerCase() === k);
    },

    /**
     * Register a new unique pilot.
     */
    register(name) {
        const cleaned = this.normalize(name);
        if (!cleaned) {
            return { ok: false, error: 'Name cannot be empty.' };
        }
        if (cleaned.length < 2) {
            return { ok: false, error: 'Name must be at least 2 characters.' };
        }
        if (cleaned.length > 16) {
            return { ok: false, error: 'Name must be 16 characters or less.' };
        }
        if (!/^[A-Za-z0-9 _\-]+$/.test(cleaned)) {
            return { ok: false, error: 'Only letters, numbers, space, _ and - allowed.' };
        }
        if (this.exists(cleaned)) {
            return { ok: false, error: 'This pilot name is already taken.' };
        }
        const list = this._load();
        const player = {
            name: cleaned,
            highScore: 0,
            lastScore: 0,
            plays: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        list.push(player);
        this._save(list);
        this.setCurrent(cleaned);
        
        // Supabase-এ ইউজার ব্যাকআপ রাখার ট্রাই (টেবিল নেম আপডেট করা হয়েছে)
        try {
            supabase.from('neo_robo_players').insert([{ player_name: cleaned, score: 0 }]).then();
        } catch(e) {}

        return { ok: true, player };
    },

    setCurrent(name) {
        this.currentPlayer = this.normalize(name);
        try { localStorage.setItem(this.CURRENT_KEY, this.currentPlayer); } catch (e) {}
    },

    loadCurrent() {
        try {
            const c = localStorage.getItem(this.CURRENT_KEY);
            this.currentPlayer = c || null;
        } catch (e) {
            this.currentPlayer = null;
        }
        return this.currentPlayer;
    },

    clearCurrent() {
        this.currentPlayer = null;
        try { localStorage.removeItem(this.CURRENT_KEY); } catch (e) {}
    },

    /**
     * Record a score for a specific pilot. Updates highScore and Syncs to Supabase.
     */
    recordScore(name, score) {
        const k = this._key(name);
        if (!k) return;
        const list = this._load();
        const idx = list.findIndex(p => (p.name || '').toLowerCase() === k);
        if (idx === -1) return;
        const p = list[idx];
        p.lastScore = score;
        p.plays = (p.plays || 0) + 1;
        if (score > (p.highScore || 0)) p.highScore = score;
        p.updatedAt = Date.now();
        list[idx] = p;
        this._save(list);

        // Supabase ডাটাবেজে লাইভ স্কোর আপলোড (টেবিল নেম আপডেট করা হয়েছে)
        try {
            supabase.from('neo_robo_players')
                .insert([{ player_name: p.name, score: score }])
                .then(res => console.log("Score synced to Supabase:", res));
        } catch (e) {
            console.error("Supabase sync failed:", e.message);
        }
    },

    /**
     * Return ranked scoreboard sorted by highScore desc.
     */
    getRanked() {
        const list = this._load().slice();
        list.sort((a, b) => {
            const sa = a.highScore || 0;
            const sb = b.highScore || 0;
            if (sb !== sa) return sb - sa;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return list.map((p, i) => ({
            rank: i + 1,
            name: p.name,
            highScore: p.highScore || 0,
            lastScore: p.lastScore || 0,
            plays: p.plays || 0
        }));
    },

    /**
     * Get rank info for a given pilot.
     */
    getRankOf(name) {
        const ranked = this.getRanked();
        const k = this._key(name);
        return ranked.find(r => (r.name || '').toLowerCase() === k) || null;
    }
};

try { PlayerRegistry.loadCurrent(); } catch (e) {}