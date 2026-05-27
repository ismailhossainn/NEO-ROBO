/* ========================================
   NEO-ROBO - Player Registry & Scoreboard
   Stores registered pilots and their scores
   in localStorage under "neoRoboPlayers".
   ======================================== */

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
     * Register a new unique pilot. Returns:
     *   { ok: true, player } on success
     *   { ok: false, error } on validation failure / duplicate
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
     * Record a score for a specific pilot. Updates highScore if needed.
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
    },

    /**
     * Return ranked scoreboard sorted by highScore desc.
     * Each entry: { rank, name, highScore, lastScore, plays }
     */
    getRanked() {
        const list = this._load().slice();
        list.sort((a, b) => {
            const sa = a.highScore || 0;
            const sb = b.highScore || 0;
            if (sb !== sa) return sb - sa;
            // tie-breaker: most recent play first
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

// Restore current player on script load (so refresh-mid-session keeps them logged in)
try { PlayerRegistry.loadCurrent(); } catch (e) {}
