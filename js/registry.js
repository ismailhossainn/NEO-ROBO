/* ========================================
   NEO-ROBO - Player Registry & Scoreboard
   Cloud leaderboard via Supabase + local fallback
   ======================================== */

// ---------- Supabase Configuration ----------
const SUPABASE_URL = "https://nvecxhclbdyywtostvdi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BiVeODTGouKI25dJGhN5vQ_-pRqOHTS";

// Initialize the Supabase Client safely from the CDN global
// The CDN loads as window.supabase (the module namespace), so we destructure createClient from it.
let supabaseClient = null;
try {
    if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase initialized successfully!");
    } else {
        console.warn("Supabase CDN not loaded yet — will retry on first use.");
    }
} catch (e) {
    console.error("Supabase initialization failed:", e);
}

const PlayerRegistry = {
    STORAGE_KEY: 'neoRoboPlayers',
    CURRENT_KEY: 'neoRoboCurrentPlayer',
    currentPlayer: null,
    _syncPromise: null,          // dedup concurrent syncs
    _clientReady: false,

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
        return this.normalize(name).toLowerCase();
    },

    // ---------- Supabase client readiness ----------
    _ensureClient() {
        if (supabaseClient) {
            this._clientReady = true;
            return supabaseClient;
        }
        // Retry once in case CDN loaded late
        try {
            if (window.supabase && window.supabase.createClient) {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                this._clientReady = true;
                return supabaseClient;
            }
        } catch (e) {}
        return null;
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

        // Upsert to Supabase (insert or update if name already exists remotely)
        this._upsertToSupabase(player).catch(() => {});
        // Background sync to merge any remote scores
        this.syncWithSupabase().catch(() => {});

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
     * Record a score for a specific pilot. Updates highScore and syncs to Supabase.
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

        // Upsert the updated record to Supabase (non-blocking)
        this._upsertToSupabase(p).catch(() => {});
    },

    /**
     * Upsert a single player record to Supabase.
     * Uses 'name' as the conflict key so remote rows are updated if they exist.
     */
    async _upsertToSupabase(player) {
        const sb = this._ensureClient();
        if (!sb) return;
        try {
            const { error } = await sb
                .from('neo_robo_players')
                .upsert([{
                    name: player.name,
                    highScore: player.highScore,
                    lastScore: player.lastScore,
                    plays: player.plays,
                    updatedAt: player.updatedAt
                }], { onConflict: 'name' });
            if (error) {
                console.warn("Supabase upsert error:", error.message);
            }
        } catch (e) {
            console.warn("Supabase upsert failed:", e.message);
        }
    },

    /**
     * Background sync: fetch all remote scores and merge with local.
     * Remote highScore wins if higher; local wins if higher (keeps best of both).
     * Deduplicates by pilot name.
     */
    async syncWithSupabase() {
        // Deduplicate concurrent calls
        if (this._syncPromise) return this._syncPromise;
        this._syncPromise = this._doSync();
        try {
            await this._syncPromise;
        } finally {
            this._syncPromise = null;
        }
    },

    async _doSync() {
        const sb = this._ensureClient();
        if (!sb) {
            console.log("Supabase client not available — using local scores only.");
            return;
        }
        try {
            const { data, error } = await sb
                .from('neo_robo_players')
                .select('*');

            if (error) {
                console.warn("Supabase select error:", error.message);
                return;
            }

            if (!data || data.length === 0) {
                // No remote data yet — push all local players up
                const localList = this._load();
                for (const p of localList) {
                    await this._upsertToSupabase(p);
                }
                return;
            }

            const localList = this._load();
            const merged = new Map();

            // Start with local data
            for (const p of localList) {
                merged.set(p.name.toLowerCase(), { ...p });
            }

            // Merge remote data (keep highest highScore, latest updatedAt)
            for (const remote of data) {
                const key = (remote.name || '').toLowerCase();
                if (!key) continue;
                const existing = merged.get(key);
                if (!existing) {
                    merged.set(key, {
                        name: remote.name,
                        highScore: remote.highScore || 0,
                        lastScore: remote.lastScore || 0,
                        plays: remote.plays || 0,
                        createdAt: remote.createdAt || Date.now(),
                        updatedAt: remote.updatedAt || Date.now()
                    });
                } else {
                    // Keep the higher highScore
                    const remoteHigh = remote.highScore || 0;
                    const localHigh = existing.highScore || 0;
                    if (remoteHigh > localHigh) {
                        existing.highScore = remoteHigh;
                        existing.lastScore = remote.lastScore || existing.lastScore;
                        existing.plays = Math.max(existing.plays || 0, remote.plays || 0);
                        existing.updatedAt = remote.updatedAt || Date.now();
                    } else if (localHigh > remoteHigh) {
                        // Local is better — push it up later
                    } else {
                        // Equal — keep latest updatedAt
                        if ((remote.updatedAt || 0) > (existing.updatedAt || 0)) {
                            existing.updatedAt = remote.updatedAt;
                            existing.lastScore = remote.lastScore || existing.lastScore;
                        }
                    }
                }
            }

            // Save merged list back to localStorage
            const finalList = Array.from(merged.values());
            this._save(finalList);

            // Push any local winners back to cloud
            for (const p of finalList) {
                const remote = data.find(r => (r.name || '').toLowerCase() === p.name.toLowerCase());
                const remoteHigh = remote ? (remote.highScore || 0) : -1;
                if ((p.highScore || 0) > remoteHigh) {
                    await this._upsertToSupabase(p);
                }
            }

            console.log("Global leaderboard synced successfully with Supabase!");
        } catch (e) {
            console.error("Error syncing with Supabase:", e.message);
        }
    },

    /**
     * Return ranked scoreboard sorted by highScore desc.
     * Ensures cloud sync has been attempted at least once.
     */
    getRanked() {
        // Fire-and-forget background sync every time the board is viewed
        this.syncWithSupabase().catch(() => {});
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

// On startup: load current pilot and attempt a background sync
try {
    PlayerRegistry.loadCurrent();
    // Delay slightly so the Supabase CDN script has time to execute
    setTimeout(() => {
        PlayerRegistry.syncWithSupabase().catch(() => {});
    }, 500);
} catch (e) {}