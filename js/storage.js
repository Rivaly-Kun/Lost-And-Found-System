// ===== Firebase Realtime Database Storage Manager =====
// Uses Firebase Realtime DB with an in-memory cache.
// Reads are synchronous (from cache), writes are async (return Promises).

const Storage = {
  _db: null,
  _usersCache: {}, // { uid: userObj }
  _itemsCache: {}, // { itemId: itemObj }
  _initialized: false,
  _readyCallbacks: [],
  _dataFlags: { users: false, items: false },

  // ---- Initialize (attach real-time listeners) ----
  init() {
    this._db = firebase.database();

    // Listen to /users node
    this._db.ref("users").on("value", (snap) => {
      this._usersCache = snap.val() || {};
      this._dataFlags.users = true;
      this._checkReady();
    });

    // Listen to /items node — automatically refreshes UI on any change
    this._db.ref("items").on("value", (snap) => {
      this._itemsCache = snap.val() || {};
      this._dataFlags.items = true;
      this._checkReady();
      // Re-render current page after initial load when items change
      if (this._initialized && typeof App !== "undefined") {
        App.renderPage(App.currentPage);
      }
    });
  },

  _checkReady() {
    if (this._dataFlags.users && this._dataFlags.items && !this._initialized) {
      this._initialized = true;
      this._readyCallbacks.forEach((cb) => cb());
      this._readyCallbacks = [];
    }
  },

  onReady(cb) {
    if (this._initialized) {
      cb();
    } else {
      this._readyCallbacks.push(cb);
    }
  },

  // ---- User Methods ----
  getUsers() {
    return Object.values(this._usersCache);
  },

  findUserByUsername(username) {
    return Object.values(this._usersCache).find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );
  },

  // Returns Promise<user>
  addUser(user) {
    const newRef = this._db.ref("users").push();
    user.id = newRef.key;
    user.createdAt = new Date().toISOString();
    return newRef.set(user).then(() => {
      this._usersCache[user.id] = user;
      return user;
    });
  },

  // ---- Session Methods (localStorage only — keeps passwords out of network) ----
  setCurrentUser(user) {
    const safeUser = { ...user };
    delete safeUser.password;
    localStorage.setItem("lf_current_user", JSON.stringify(safeUser));
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem("lf_current_user");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clearCurrentUser() {
    localStorage.removeItem("lf_current_user");
  },

  // ---- Item Methods ----
  getItems() {
    return Object.values(this._itemsCache);
  },

  getItemById(id) {
    return this._itemsCache[id] || null;
  },

  // Returns Promise<item>
  addItem(item) {
    const newRef = this._db.ref("items").push();
    item.id = newRef.key;
    item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    return newRef.set(item).then(() => {
      this._itemsCache[item.id] = item;
      return item;
    });
  },

  // Returns Promise<updatedItem>
  updateItem(id, updates) {
    const existing = this._itemsCache[id];
    if (!existing) return Promise.reject(new Error("Item not found"));
    const merged = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this._db
      .ref("items/" + id)
      .set(merged)
      .then(() => {
        this._itemsCache[id] = merged;
        return merged;
      });
  },

  // Returns Promise<boolean>
  deleteItem(id) {
    return this._db
      .ref("items/" + id)
      .remove()
      .then(() => {
        delete this._itemsCache[id];
        return true;
      });
  },

  // ---- Query Helpers (sync reads from cache) ----
  filterItems({ type, status, query } = {}) {
    let items = this.getItems();

    if (type && type !== "all") {
      items = items.filter((i) => i.type === type);
    }

    if (status && status !== "all") {
      items = items.filter((i) => i.status === status);
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    }

    // Newest first
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items;
  },

  getStats() {
    const items = this.getItems();
    return {
      totalLost: items.filter((i) => i.type === "lost").length,
      totalFound: items.filter((i) => i.type === "found").length,
      claimed: items.filter((i) => i.status === "claimed").length,
      pending: items.filter((i) => i.status === "pending").length,
      awaitingClaim: items.filter((i) => i.status === "found - awaiting claim")
        .length,
      matched: items.filter((i) => i.status === "matched").length,
      total: items.length,
    };
  },

  // ---- Seed Default Admin (only if /users node is empty) ----
  seedDefaultAdmin() {
    if (this.getUsers().length === 0) {
      return this.addUser({
        fullName: "System Administrator",
        username: "admin",
        password: "admin123",
        role: "admin",
      });
    }
    return Promise.resolve();
  },
};
