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
        
        // Supabase-এ ইউজার ব্যাকআপ রাখা
        try {
            supabase.from('neo_robo_players').insert([{ 
                name: cleaned, 
                highScore: 0,
                lastScore: 0,
                plays: 0,
                updatedAt: Date.now()
            }]).then(() => {
                // ডাটা ইনসার্ট হওয়ার পর গ্লোবাল স্কোর সিঙ্ক করে নেওয়া
                this.syncWithSupabase();
            });
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

        // Supabase-এ ডাটা আপলোড বা আপডেট করা
        try {
            supabase.from('neo_robo_players')
                .insert([{ 
                    name: p.name, 
                    highScore: p.highScore,
                    lastScore: p.lastScore,
                    plays: p.plays,
                    updatedAt: p.updatedAt
                }])
                .then(res => {
                    console.log("Score synced to Supabase:", res);
                    // স্কোর আপলোড শেষে নতুন গ্লোবাল বোর্ড ব্যাকগ্রাউন্ডে নামিয়ে নেওয়া
                    this.syncWithSupabase();
                });
        } catch (e) {
            console.error("Supabase sync failed:", e.message);
        }
    },

    /**
     * ব্যাকগ্রাউন্ডে সুপাবেস থেকে ডাটা এনে লোকাল স্টোরেজে সিঙ্ক করার নতুন মেথড।
     * এর ফলে অন্য কোনো ফাইলে 'await' বা কোনো চেঞ্জ করতে হবে না।
     */
    async syncWithSupabase() {
        try {
            const { data, error } = await supabase
                .from('neo_robo_players')
                .select('*');

            if (error) throw error;

            if (data && data.length > 0) {
                const localList = this._load();
                
                // সুপাবেসের ডাটা দিয়ে লোকাল ডাটা আপডেট বা মার্জ করা
                data.forEach(remotePlayer => {
                    const localIdx = localList.findIndex(p => p.name.toLowerCase() === remotePlayer.name.toLowerCase());
                    
                    if (localIdx === -1) {
                        // লোকাল স্টোরেজে না থাকলে নতুন প্লেয়ার হিসেবে পুশ হবে
                        localList.push({
                            name: remotePlayer.name,
                            highScore: remotePlayer.highScore || 0,
                            lastScore: remotePlayer.lastScore || 0,
                            plays: remotePlayer.plays || 0,
                            updatedAt: remotePlayer.updatedAt || Date.now()
                        });
                    } else {
                        // অলরেডি থাকলে যার হাইস্কোর বেশি বা লেটেস্ট, সেটা আপডেট হবে
                        if ((remotePlayer.highScore || 0) > (localList[localIdx].highScore || 0)) {
                            localList[localIdx].highScore = remotePlayer.highScore;
                            localList[localIdx].lastScore = remotePlayer.lastScore;
                            localList[localIdx].plays = remotePlayer.plays;
                            localList[localIdx].updatedAt = remotePlayer.updatedAt;
                        }
                    }
                });

                this._save(localList);
                console.log("Global leaderboard synced successfully from Supabase!");
            }
        } catch (e) {
            console.error("Error syncing with Supabase:", e);
        }
    },

    /**
     * Return ranked scoreboard sorted by highScore desc.
     * (এখন এটি সুপাবেস থেকে সিঙ্ক হওয়া লেটেস্ট গ্লোবাল ডাটাই রিটার্ন করবে)
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

// গেম চালু হওয়ার সাথে সাথেই ব্যাকগ্রাউন্ডে সুপাবেস থেকে গ্লোবাল ডাটা লোড হবে
try { 
    PlayerRegistry.loadCurrent(); 
    PlayerRegistry.syncWithSupabase();
} catch (e) {}