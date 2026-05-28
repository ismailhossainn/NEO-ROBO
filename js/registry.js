recordScore(name, score) {
    const k = this._key(name);
    if (!k) return;

    const list = this._load();
    const idx = list.findIndex(
        p => (p.name || '').toLowerCase() === k
    );

    // Player না থাকলে auto create
    if (idx === -1) {
        const newPlayer = {
            name: name,
            highScore: score,
            lastScore: score,
            plays: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        list.push(newPlayer);
        this._save(list);

        // Cloud save
        this._upsertToSupabase(newPlayer)
            .then(() => {
                console.log("New player uploaded to cloud!");
            })
            .catch(err => {
                console.error("Supabase upload failed:", err);
            });

        return;
    }

    const p = list[idx];

    p.lastScore = score;
    p.plays = (p.plays || 0) + 1;

    // Highest score save
    if (score > (p.highScore || 0)) {
        p.highScore = score;
    }

    p.updatedAt = Date.now();

    list[idx] = p;

    // Save locally
    this._save(list);

    console.log("Uploading score to Supabase...", p);

    // Upload to Supabase
    this._upsertToSupabase(p)
        .then(() => {
            console.log("Score synced globally!");
        })
        .catch(err => {
            console.error("Cloud sync failed:", err);
        });

    // Refresh leaderboard
    this.syncWithSupabase()
        .then(() => {
            console.log("Leaderboard updated!");
        })
        .catch(err => {
            console.error("Leaderboard sync failed:", err);
        });
}