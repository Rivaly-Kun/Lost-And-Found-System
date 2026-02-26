// ===== Items Module =====
// Read methods are synchronous (from in-memory cache).
// Write methods are async and return Promises.

const Items = {
  // ---- Report Lost/Found (async) ----
  reportLost(data) {
    return this._reportItem({ ...data, type: "lost" });
  },

  reportFound(data) {
    return this._reportItem({ ...data, type: "found" });
  },

  // Report a found item that matches an existing lost item (async)
  reportFoundWithMatch(data, lostItemId) {
    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      return Promise.resolve({
        success: false,
        message: "You must be logged in.",
      });
    }

    const lostItem = Storage.getItemById(lostItemId);
    if (!lostItem) {
      return Promise.resolve({
        success: false,
        message: "The selected lost item no longer exists.",
      });
    }
    if (lostItem.status !== "pending") {
      return Promise.resolve({
        success: false,
        message: "This lost item has already been matched or claimed.",
      });
    }

    // Create found item linked to the lost item
    return Storage.addItem({
      type: "found",
      name: lostItem.name,
      description: data.description
        ? data.description.trim()
        : lostItem.description,
      category: lostItem.category,
      date: data.date || new Date().toISOString().split("T")[0],
      location: data.location ? data.location.trim() : "",
      contactInfo: data.contactInfo ? data.contactInfo.trim() : "",
      reportedBy: currentUser.username,
      status: "matched",
      linkedLostItemId: lostItemId,
    })
      .then((foundItem) => {
        // Update the lost item status
        return Storage.updateItem(lostItemId, {
          status: "found - awaiting claim",
          linkedFoundItemId: foundItem.id,
          foundByUser: currentUser.username,
        }).then(() => ({
          success: true,
          message: `Item matched! Please bring "${lostItem.name}" to the Faculty Room / Lost & Found Office for the owner to claim.`,
          item: foundItem,
        }));
      })
      .catch(() => ({
        success: false,
        message: "Failed to save. Please try again.",
      }));
  },

  // Get all pending lost items (for the match dropdown)
  getPendingLostItems() {
    return Storage.getItems()
      .filter((i) => i.type === "lost" && i.status === "pending")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  _reportItem(data) {
    if (!data.name || !data.name.trim()) {
      return Promise.resolve({
        success: false,
        message: "Item name is required.",
      });
    }
    if (!data.description || !data.description.trim()) {
      return Promise.resolve({
        success: false,
        message: "Description is required.",
      });
    }
    if (!data.date) {
      return Promise.resolve({ success: false, message: "Date is required." });
    }
    if (!data.location || !data.location.trim()) {
      return Promise.resolve({
        success: false,
        message: "Location is required.",
      });
    }

    const currentUser = Auth.getCurrentUser();
    if (!currentUser) {
      return Promise.resolve({
        success: false,
        message: "You must be logged in to report an item.",
      });
    }

    return Storage.addItem({
      type: data.type,
      name: data.name.trim(),
      description: data.description.trim(),
      category: data.category || "other",
      date: data.date,
      location: data.location.trim(),
      contactInfo: data.contactInfo ? data.contactInfo.trim() : "",
      reportedBy: currentUser.username,
      status: "pending",
    })
      .then((item) => {
        const label = data.type === "lost" ? "Lost" : "Found";
        return {
          success: true,
          message: `${label} item reported successfully!`,
          item,
        };
      })
      .catch(() => ({
        success: false,
        message: "Failed to save item to database. Please try again.",
      }));
  },

  // ---- Read Methods (sync from cache) ----
  getAll(filters = {}) {
    return Storage.filterItems(filters);
  },

  getById(id) {
    return Storage.getItemById(id);
  },

  getStats() {
    return Storage.getStats();
  },

  getByUser(username) {
    return Storage.getItems()
      .filter((i) => i.reportedBy === username)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  // ---- Update Status (async) ----
  updateStatus(id, newStatus) {
    const user = Auth.getCurrentUser();
    if (!user) {
      return Promise.resolve({ success: false, message: "Not authorized." });
    }

    const item = Storage.getItemById(id);
    if (!item) {
      return Promise.resolve({ success: false, message: "Item not found." });
    }

    if (user.role !== "admin" && user.username !== item.reportedBy) {
      return Promise.resolve({
        success: false,
        message: "You do not have permission to update this item.",
      });
    }

    return Storage.updateItem(id, { status: newStatus })
      .then((updated) => {
        // When claiming a lost item that was matched, also claim the linked found item
        if (newStatus === "claimed" && updated.linkedFoundItemId) {
          Storage.updateItem(updated.linkedFoundItemId, {
            status: "claimed",
          }).catch(() => {});
        }
        // When claiming a found item that was matched, also claim the linked lost item
        if (newStatus === "claimed" && updated.linkedLostItemId) {
          Storage.updateItem(updated.linkedLostItemId, {
            status: "claimed",
          }).catch(() => {});
        }
        return {
          success: true,
          message: `Item status updated to "${newStatus}".`,
          item: updated,
        };
      })
      .catch(() => ({
        success: false,
        message: "Failed to update item. Please try again.",
      }));
  },

  // ---- Delete Item (async, admin only) ----
  deleteItem(id) {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== "admin") {
      return Promise.resolve({
        success: false,
        message: "Only admins can delete items.",
      });
    }

    return Storage.deleteItem(id)
      .then(() => ({ success: true, message: "Item deleted successfully." }))
      .catch(() => ({
        success: false,
        message: "Failed to delete item. Please try again.",
      }));
  },
};
