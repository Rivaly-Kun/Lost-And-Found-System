// ===== Main Application Controller =====
// Handles UI rendering, navigation, and event binding.
// Reads are sync (cache); writes use async/await via returned Promises.

const App = {
  currentPage: "dashboard",

  // ---- Initialize Application ----
  init() {
    // Show loading screen while Firebase loads data
    this._showLoading();

    // Start Firebase real-time listeners
    Storage.init();

    // Wait until both /users and /items have loaded from Firebase
    Storage.onReady(async () => {
      // Seed default admin account if no users exist in the database
      await Storage.seedDefaultAdmin();

      this._hideLoading();

      if (Auth.isLoggedIn()) {
        this.showApp();
      } else {
        this.showLogin();
      }
    });
  },

  _showLoading() {
    document.getElementById("loading-screen").classList.remove("hidden");
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("app-page").classList.add("hidden");
  },

  _hideLoading() {
    document.getElementById("loading-screen").classList.add("hidden");
  },

  // ---- Show Login Page ----
  showLogin() {
    document.getElementById("login-page").classList.remove("hidden");
    document.getElementById("app-page").classList.add("hidden");
    this.initLoginPage();
  },

  // ---- Show Main App ----
  showApp() {
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("app-page").classList.remove("hidden");
    this.updateUserInfo();
    this.updateSidebar();
    this.navigateTo("dashboard");
  },

  // ---- Login Page Logic ----
  initLoginPage() {
    const loginTab = document.getElementById("tab-login");
    const registerTab = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    loginTab.onclick = () => {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      this.clearAlerts();
    };

    registerTab.onclick = () => {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
      this.clearAlerts();
    };

    // Login form handler (synchronous)
    document.getElementById("form-login").onsubmit = (e) => {
      e.preventDefault();
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;

      if (!username || !password) {
        this.showAlert(
          "login-alert",
          "Please enter both username and password.",
          "danger",
        );
        return;
      }

      const result = Auth.login(username, password);
      if (result.success) {
        this.showApp();
        this.showToast(result.message, "success");
      } else {
        this.showAlert("login-alert", result.message, "danger");
      }
    };

    // Register form handler (async — writes to Firebase)
    document.getElementById("form-register").onsubmit = async (e) => {
      e.preventDefault();
      const fullName = document.getElementById("reg-fullname").value;
      const username = document.getElementById("reg-username").value;
      const password = document.getElementById("reg-password").value;
      const confirm = document.getElementById("reg-confirm").value;

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      const result = await Auth.register(fullName, username, password, confirm);

      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";

      if (result.success) {
        this.showApp();
        this.showToast(result.message, "success");
      } else {
        this.showAlert("register-alert", result.message, "danger");
      }
    };
  },

  // ---- Sidebar & Navigation ----
  updateSidebar() {
    const adminNav = document.getElementById("admin-nav-section");
    if (Auth.isAdmin()) {
      adminNav.classList.remove("hidden");
    } else {
      adminNav.classList.add("hidden");
    }
  },

  navigateTo(page) {
    this.currentPage = page;

    // Update nav active state
    document
      .querySelectorAll(".nav-item")
      .forEach((el) => el.classList.remove("active"));
    const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add("active");

    // Update page title
    const titles = {
      dashboard: "Dashboard",
      "report-lost": "Report Lost Item",
      "report-found": "Report Found Item",
      "all-items": "All Items",
      "my-reports": "My Reports",
      "admin-manage": "Manage Items",
      "admin-users": "Manage Users",
    };
    document.getElementById("page-title").textContent =
      titles[page] || "Dashboard";

    this.renderPage(page);
  },

  renderPage(page) {
    const content = document.getElementById("content-area");
    if (!content) return;

    switch (page) {
      case "dashboard":
        content.innerHTML = this.renderDashboard();
        break;
      case "report-lost":
        content.innerHTML = this.renderReportForm("lost");
        this.bindReportFormEvents("lost");
        break;
      case "report-found":
        content.innerHTML = this.renderReportForm("found");
        this.bindReportFormEvents("found");
        break;
      case "all-items":
        content.innerHTML = this.renderAllItems();
        this.bindAllItemsEvents();
        break;
      case "my-reports":
        content.innerHTML = this.renderMyReports();
        break;
      case "admin-manage":
        content.innerHTML = this.renderAdminManage();
        this.bindAdminManageEvents();
        break;
      case "admin-users":
        content.innerHTML = this.renderAdminUsers();
        break;
      default:
        content.innerHTML = this.renderDashboard();
    }
  },

  // ---- Dashboard ----
  renderDashboard() {
    const stats = Items.getStats();
    const recentItems = Items.getAll({}).slice(0, 6);

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon lost">&#128270;</div>
          <div class="stat-info">
            <h4>${stats.totalLost}</h4>
            <p>Lost Items</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon found">&#9989;</div>
          <div class="stat-info">
            <h4>${stats.totalFound}</h4>
            <p>Found Items</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon claimed">&#127873;</div>
          <div class="stat-info">
            <h4>${stats.claimed}</h4>
            <p>Claimed</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon pending">&#9203;</div>
          <div class="stat-info">
            <h4>${stats.pending}</h4>
            <p>Pending</p>
          </div>
        </div>
      </div>

      ${
        stats.awaitingClaim > 0
          ? `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-body">
          <div class="match-info-banner" style="margin-bottom:0;">
            <span class="match-info-icon">&#127963;&#65039;</span>
            <div>
              <strong>${stats.awaitingClaim} item(s)</strong> have been found and are
              <strong>waiting to be claimed</strong> at the Faculty Room / Lost &amp; Found Office.
            </div>
          </div>
        </div>
      </div>`
          : ""
      }


      <div class="card">
        <div class="card-header">
          <h3>Recent Reports</h3>
          <button class="btn btn-primary btn-sm" onclick="App.navigateTo('all-items')">View All</button>
        </div>
        <div class="card-body">
          ${
            recentItems.length > 0
              ? `<div class="items-grid">${recentItems.map((item) => this.renderItemCard(item)).join("")}</div>`
              : `<div class="empty-state">
                  <div class="empty-icon">&#128196;</div>
                  <h4>No items reported yet</h4>
                  <p>Start by reporting a lost or found item using the sidebar navigation.</p>
                </div>`
          }
        </div>
      </div>
    `;
  },

  // ---- Report Form (Lost) ----
  renderReportForm(type) {
    if (type === "found") return this.renderReportFoundPage();
    return this._renderGenericReportForm(type);
  },

  _renderGenericReportForm(type) {
    const label = type === "lost" ? "Lost" : "Found";
    const icon = type === "lost" ? "&#128270;" : "&#9989;";
    const today = new Date().toISOString().split("T")[0];

    return `
      <div class="card" style="max-width: 700px;">
        <div class="card-header">
          <h3>${icon} Report ${label} Item</h3>
        </div>
        <div class="card-body">
          <div id="report-alert"></div>
          <form id="report-form">
            <div class="form-group">
              <label for="item-name">Item Name *</label>
              <input type="text" id="item-name" class="form-control" placeholder="e.g., Blue Backpack, Student ID, Phone" required>
            </div>

            <div class="form-group">
              <label for="item-category">Category</label>
              <select id="item-category" class="form-control">
                <option value="electronics">Electronics</option>
                <option value="documents">Documents / IDs</option>
                <option value="bags">Bags / Wallets</option>
                <option value="clothing">Clothing</option>
                <option value="accessories">Accessories / Jewelry</option>
                <option value="books">Books / Stationery</option>
                <option value="other" selected>Other</option>
              </select>
            </div>

            <div class="form-group">
              <label for="item-description">Description *</label>
              <textarea id="item-description" class="form-control" rows="4"
                placeholder="Provide a detailed description: color, brand, distinguishing features, contents..." required></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="item-date">Date ${type === "lost" ? "Lost" : "Found"} *</label>
                <input type="date" id="item-date" class="form-control" max="${today}" required>
              </div>
              <div class="form-group">
                <label for="item-location">Location *</label>
                <input type="text" id="item-location" class="form-control" placeholder="e.g., Library 2nd Floor, Room 301" required>
              </div>
            </div>

            <div class="form-group">
              <label for="item-contact">Contact Information (optional)</label>
              <input type="text" id="item-contact" class="form-control" placeholder="Phone number or email for direct contact">
            </div>

            <div class="btn-group" style="margin-top: 0.5rem;">
              <button type="submit" id="report-submit-btn" class="btn btn-primary">&#128190; Submit Report</button>
              <button type="button" class="btn btn-outline" onclick="App.navigateTo('dashboard')">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // ---- Report Found Page (special — with lost-item matching) ----
  renderReportFoundPage() {
    const pendingLost = Items.getPendingLostItems();
    const today = new Date().toISOString().split("T")[0];

    const lostOptions = pendingLost
      .map(
        (item) =>
          `<option value="${item.id}">${this.escapeHtml(item.name)} — ${this.escapeHtml(item.category)} (${this.escapeHtml(item.location)}, ${this.formatDate(item.date)})</option>`,
      )
      .join("");

    return `
      <div style="max-width: 720px;">
        <!-- Mode Toggle -->
        <div class="found-mode-toggle">
          <button class="found-mode-btn active" id="mode-match-btn">&#128279; Match to a Lost Item</button>
          <button class="found-mode-btn" id="mode-new-btn">&#10133; Report New Found Item</button>
        </div>

        <!-- ===== MODE 1: MATCH TO EXISTING LOST ITEM ===== -->
        <div id="found-match-section">
          ${
            pendingLost.length > 0
              ? `
            <div class="card">
              <div class="card-header">
                <h3>&#128279; Match Found Item to a Lost Report</h3>
              </div>
              <div class="card-body">
                <div id="report-alert"></div>

                <div class="match-info-banner">
                  <span class="match-info-icon">&#128161;</span>
                  <div>
                    <strong>How it works:</strong> Select a lost item someone reported below. If you've found it,
                    we'll link the reports and update the status so the owner knows.
                    <strong>Please bring the item to the Faculty Room / Lost &amp; Found Office.</strong>
                  </div>
                </div>

                <form id="found-match-form">
                  <div class="form-group">
                    <label for="match-lost-item">Select the Lost Item You Found *</label>
                    <select id="match-lost-item" class="form-control" required>
                      <option value="">— Choose a lost item —</option>
                      ${lostOptions}
                    </select>
                  </div>

                  <!-- Preview of selected lost item -->
                  <div id="match-preview" class="hidden">
                    <div class="match-preview-card">
                      <div class="match-preview-header">
                        <span class="badge badge-lost">Lost</span>
                        <span id="preview-name" style="font-weight:700;"></span>
                      </div>
                      <div class="match-preview-body">
                        <div class="item-detail"><span class="detail-label">Category:</span><span class="detail-value" id="preview-category"></span></div>
                        <div class="item-detail"><span class="detail-label">Description:</span><span class="detail-value" id="preview-description"></span></div>
                        <div class="item-detail"><span class="detail-label">Date Lost:</span><span class="detail-value" id="preview-date"></span></div>
                        <div class="item-detail"><span class="detail-label">Location:</span><span class="detail-value" id="preview-location"></span></div>
                        <div class="item-detail"><span class="detail-label">Reported by:</span><span class="detail-value" id="preview-reporter"></span></div>
                      </div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="match-found-location">Where Did You Find It? *</label>
                    <input type="text" id="match-found-location" class="form-control" placeholder="e.g., Cafeteria, Room 201, Hallway B" required>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label for="match-found-date">Date Found</label>
                      <input type="date" id="match-found-date" class="form-control" value="${today}" max="${today}">
                    </div>
                    <div class="form-group">
                      <label for="match-found-contact">Your Contact Info (optional)</label>
                      <input type="text" id="match-found-contact" class="form-control" placeholder="Phone or email">
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="match-found-notes">Additional Notes (optional)</label>
                    <textarea id="match-found-notes" class="form-control" rows="3"
                      placeholder="Any extra details — condition of the item, where exactly you left it, etc."></textarea>
                  </div>

                  <div class="turnover-banner">
                    <span>&#127963;&#65039;</span>
                    <div>
                      <strong>Next Step:</strong> After submitting, please turn over the item to the
                      <strong>Faculty Room / Lost &amp; Found Office</strong> so the owner can claim it.
                    </div>
                  </div>

                  <div class="btn-group" style="margin-top: 1rem;">
                    <button type="submit" id="match-submit-btn" class="btn btn-success">&#9989; Submit &amp; Link to Lost Item</button>
                    <button type="button" class="btn btn-outline" onclick="App.navigateTo('dashboard')">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          `
              : `
            <div class="card">
              <div class="card-body">
                <div class="empty-state">
                  <div class="empty-icon">&#128079;</div>
                  <h4>No pending lost items to match</h4>
                  <p>There are no reported lost items waiting to be found right now. You can still report a new found item using the other tab above.</p>
                </div>
              </div>
            </div>
          `
          }
        </div>

        <!-- ===== MODE 2: REPORT NEW FOUND ITEM (no match) ===== -->
        <div id="found-new-section" class="hidden">
          <div class="card">
            <div class="card-header">
              <h3>&#10133; Report a New Found Item</h3>
            </div>
            <div class="card-body">
              <div id="report-alert-new"></div>
              <div class="match-info-banner" style="margin-bottom: 1.25rem;">
                <span class="match-info-icon">&#128161;</span>
                <div>
                  Use this form if you found an item that <strong>hasn't been reported lost yet</strong>.
                  It will be listed so the owner can find it.
                  <strong>Please bring the item to the Faculty Room / Lost &amp; Found Office.</strong>
                </div>
              </div>
              <form id="report-form">
                <div class="form-group">
                  <label for="item-name">Item Name *</label>
                  <input type="text" id="item-name" class="form-control" placeholder="e.g., Blue Backpack, Student ID, Phone" required>
                </div>
                <div class="form-group">
                  <label for="item-category">Category</label>
                  <select id="item-category" class="form-control">
                    <option value="electronics">Electronics</option>
                    <option value="documents">Documents / IDs</option>
                    <option value="bags">Bags / Wallets</option>
                    <option value="clothing">Clothing</option>
                    <option value="accessories">Accessories / Jewelry</option>
                    <option value="books">Books / Stationery</option>
                    <option value="other" selected>Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="item-description">Description *</label>
                  <textarea id="item-description" class="form-control" rows="4"
                    placeholder="Color, brand, distinguishing features, contents..." required></textarea>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="item-date">Date Found *</label>
                    <input type="date" id="item-date" class="form-control" value="${today}" max="${today}" required>
                  </div>
                  <div class="form-group">
                    <label for="item-location">Where Did You Find It? *</label>
                    <input type="text" id="item-location" class="form-control" placeholder="e.g., Library 2nd Floor, Room 301" required>
                  </div>
                </div>
                <div class="form-group">
                  <label for="item-contact">Your Contact Info (optional)</label>
                  <input type="text" id="item-contact" class="form-control" placeholder="Phone number or email">
                </div>

                <div class="turnover-banner">
                  <span>&#127963;&#65039;</span>
                  <div>
                    <strong>Reminder:</strong> Please turn over the found item to the
                    <strong>Faculty Room / Lost &amp; Found Office</strong>.
                  </div>
                </div>

                <div class="btn-group" style="margin-top: 1rem;">
                  <button type="submit" id="report-submit-btn" class="btn btn-primary">&#128190; Submit Found Report</button>
                  <button type="button" class="btn btn-outline" onclick="App.navigateTo('dashboard')">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  bindReportFormEvents(type) {
    if (type === "found") {
      this._bindFoundPageEvents();
      return;
    }
    // Lost item form
    document.getElementById("report-form").onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById("item-name").value,
        category: document.getElementById("item-category").value,
        description: document.getElementById("item-description").value,
        date: document.getElementById("item-date").value,
        location: document.getElementById("item-location").value,
        contactInfo: document.getElementById("item-contact").value,
      };

      const submitBtn = document.getElementById("report-submit-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving to database...";

      const result = await Items.reportLost(data);

      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Report";

      if (result.success) {
        this.showToast(result.message, "success");
        this.navigateTo("all-items");
      } else {
        this.showAlert("report-alert", result.message, "danger");
      }
    };
  },

  _bindFoundPageEvents() {
    // Mode toggle buttons
    const matchBtn = document.getElementById("mode-match-btn");
    const newBtn = document.getElementById("mode-new-btn");
    const matchSection = document.getElementById("found-match-section");
    const newSection = document.getElementById("found-new-section");

    if (matchBtn && newBtn) {
      matchBtn.onclick = () => {
        matchBtn.classList.add("active");
        newBtn.classList.remove("active");
        matchSection.classList.remove("hidden");
        newSection.classList.add("hidden");
      };
      newBtn.onclick = () => {
        newBtn.classList.add("active");
        matchBtn.classList.remove("active");
        newSection.classList.remove("hidden");
        matchSection.classList.add("hidden");
      };
    }

    // Lost item preview on select change
    const matchSelect = document.getElementById("match-lost-item");
    const preview = document.getElementById("match-preview");
    if (matchSelect) {
      matchSelect.onchange = () => {
        const id = matchSelect.value;
        if (!id) {
          preview && preview.classList.add("hidden");
          return;
        }
        const item = Items.getById(id);
        if (!item) {
          preview && preview.classList.add("hidden");
          return;
        }
        document.getElementById("preview-name").textContent = item.name;
        document.getElementById("preview-category").textContent = item.category;
        document.getElementById("preview-description").textContent =
          item.description;
        document.getElementById("preview-date").textContent = this.formatDate(
          item.date,
        );
        document.getElementById("preview-location").textContent = item.location;
        document.getElementById("preview-reporter").textContent =
          item.reportedBy;
        preview.classList.remove("hidden");
      };
    }

    // MATCH form submit
    const matchForm = document.getElementById("found-match-form");
    if (matchForm) {
      matchForm.onsubmit = async (e) => {
        e.preventDefault();
        const lostItemId = document.getElementById("match-lost-item").value;
        if (!lostItemId) {
          this.showAlert(
            "report-alert",
            "Please select a lost item to match.",
            "danger",
          );
          return;
        }

        const data = {
          location: document.getElementById("match-found-location").value,
          date: document.getElementById("match-found-date").value,
          contactInfo: document.getElementById("match-found-contact").value,
          description: document.getElementById("match-found-notes").value,
        };

        const submitBtn = document.getElementById("match-submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Linking & saving...";

        const result = await Items.reportFoundWithMatch(data, lostItemId);

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit & Link to Lost Item";

        if (result.success) {
          this.showToast(result.message, "success");
          this.navigateTo("all-items");
        } else {
          this.showAlert("report-alert", result.message, "danger");
        }
      };
    }

    // NEW (unmatched) found item form submit
    const newForm = document.getElementById("report-form");
    if (newForm) {
      newForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById("item-name").value,
          category: document.getElementById("item-category").value,
          description: document.getElementById("item-description").value,
          date: document.getElementById("item-date").value,
          location: document.getElementById("item-location").value,
          contactInfo: document.getElementById("item-contact").value,
        };

        const submitBtn = document.getElementById("report-submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving to database...";

        const result = await Items.reportFound(data);

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Found Report";

        if (result.success) {
          this.showToast(result.message, "success");
          this.navigateTo("all-items");
        } else {
          this.showAlert("report-alert-new", result.message, "danger");
        }
      };
    }
  },

  // ---- All Items ----
  renderAllItems() {
    return `
      <div class="filter-bar">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="search-input" placeholder="Search by item name, location, or description...">
        </div>
        <select id="filter-type" class="filter-select">
          <option value="all">All Types</option>
          <option value="lost">Lost Items</option>
          <option value="found">Found Items</option>
        </select>
        <select id="filter-status" class="filter-select">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="found - awaiting claim">Awaiting Claim</option>
          <option value="matched">Matched</option>
          <option value="claimed">Claimed</option>
        </select>
      </div>
      <div id="items-container" class="items-grid">
        ${this.renderFilteredItems()}
      </div>
    `;
  },

  renderFilteredItems(filters = {}) {
    const items = Items.getAll(filters);
    if (items.length === 0) {
      return `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">&#128270;</div>
          <h4>No items found</h4>
          <p>Try adjusting your search or filters, or report a new item.</p>
        </div>
      `;
    }
    return items.map((item) => this.renderItemCard(item)).join("");
  },

  bindAllItemsEvents() {
    const searchInput = document.getElementById("search-input");
    const filterType = document.getElementById("filter-type");
    const filterStatus = document.getElementById("filter-status");

    const refreshItems = () => {
      const container = document.getElementById("items-container");
      if (!container) return;
      container.innerHTML = this.renderFilteredItems({
        query: searchInput.value,
        type: filterType.value,
        status: filterStatus.value,
      });
    };

    searchInput.oninput = refreshItems;
    filterType.onchange = refreshItems;
    filterStatus.onchange = refreshItems;
  },

  // ---- My Reports ----
  renderMyReports() {
    const user = Auth.getCurrentUser();
    const myItems = Items.getByUser(user.username);

    return `
      <div class="card">
        <div class="card-header">
          <h3>Your Reported Items (${myItems.length})</h3>
          <div class="btn-group">
            <button class="btn btn-primary btn-sm" onclick="App.navigateTo('report-lost')">+ Report Lost</button>
            <button class="btn btn-success btn-sm" onclick="App.navigateTo('report-found')">+ Report Found</button>
          </div>
        </div>
        <div class="card-body">
          ${
            myItems.length > 0
              ? `<div class="items-grid">${myItems.map((item) => this.renderItemCard(item, true)).join("")}</div>`
              : `<div class="empty-state">
                  <div class="empty-icon">&#128203;</div>
                  <h4>No reports yet</h4>
                  <p>You haven't reported any lost or found items. Use the buttons above to get started.</p>
                </div>`
          }
        </div>
      </div>
    `;
  },

  // ---- Admin: Manage Items ----
  renderAdminManage() {
    if (!Auth.isAdmin()) {
      return '<div class="alert alert-danger">Access denied. Admin only.</div>';
    }

    const allItems = Items.getAll({});

    return `
      <div class="filter-bar">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="admin-search" placeholder="Search items...">
        </div>
        <select id="admin-filter-type" class="filter-select">
          <option value="all">All Types</option>
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>
        <select id="admin-filter-status" class="filter-select">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="found - awaiting claim">Awaiting Claim</option>
          <option value="matched">Matched</option>
          <option value="claimed">Claimed</option>
        </select>
      </div>

      <div class="card">
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Reported By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="admin-items-body">
                ${this.renderAdminItemsRows(allItems)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  renderAdminItemsRows(items) {
    if (items.length === 0) {
      return '<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No items found.</td></tr>';
    }

    return items
      .map(
        (item) => `
        <tr data-id="${item.id}">
          <td>
            <strong>${this.escapeHtml(item.name)}</strong>
            <br><small class="text-muted">${this.escapeHtml(item.category)}</small>
          </td>
          <td><span class="badge badge-${item.type}">${item.type}</span></td>
          <td>${this.escapeHtml(item.location)}</td>
          <td>${this.formatDate(item.date)}</td>
          <td>${this.escapeHtml(item.reportedBy)}</td>
          <td><span class="badge badge-${this._badgeClass(item.status)}">${item.status}</span></td>
          <td>
            <div class="actions-cell">
              <select class="form-control btn-sm admin-status-select" data-id="${item.id}"
                style="width: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                <option value="pending" ${item.status === "pending" ? "selected" : ""}>Pending</option>
                <option value="found - awaiting claim" ${item.status === "found - awaiting claim" ? "selected" : ""}>Awaiting Claim</option>
                <option value="matched" ${item.status === "matched" ? "selected" : ""}>Matched</option>
                <option value="claimed" ${item.status === "claimed" ? "selected" : ""}>Claimed</option>
              </select>
              <button class="btn btn-danger btn-sm admin-delete-btn" data-id="${item.id}" title="Delete">&#128465;</button>
            </div>
          </td>
        </tr>
      `,
      )
      .join("");
  },

  bindAdminManageEvents() {
    const searchInput = document.getElementById("admin-search");
    const filterType = document.getElementById("admin-filter-type");
    const filterStatus = document.getElementById("admin-filter-status");

    const refreshTable = () => {
      const items = Items.getAll({
        query: searchInput.value,
        type: filterType.value,
        status: filterStatus.value,
      });
      const tbody = document.getElementById("admin-items-body");
      if (tbody) {
        tbody.innerHTML = this.renderAdminItemsRows(items);
        this.bindAdminTableActions();
      }
    };

    searchInput.oninput = refreshTable;
    filterType.onchange = refreshTable;
    filterStatus.onchange = refreshTable;

    this.bindAdminTableActions();
  },

  bindAdminTableActions() {
    // Status change dropdowns (async)
    document.querySelectorAll(".admin-status-select").forEach((select) => {
      select.onchange = async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        e.target.disabled = true;
        const result = await Items.updateStatus(id, newStatus);
        e.target.disabled = false;
        if (result.success) {
          this.showToast(result.message, "success");
        } else {
          this.showToast(result.message, "error");
        }
      };
    });

    // Delete buttons (async)
    document.querySelectorAll(".admin-delete-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        this.showConfirmModal(
          "Delete this item? This action cannot be undone.",
          async () => {
            this.closeModal();
            const result = await Items.deleteItem(id);
            if (result.success) {
              this.showToast(result.message, "success");
            } else {
              this.showToast(result.message, "error");
            }
          },
        );
      };
    });
  },

  // ---- Admin: Users ----
  renderAdminUsers() {
    if (!Auth.isAdmin()) {
      return '<div class="alert alert-danger">Access denied. Admin only.</div>';
    }

    const users = Storage.getUsers();

    return `
      <div class="card">
        <div class="card-header">
          <h3>Registered Users (${users.length})</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Registered</th>
                  <th>Reports</th>
                </tr>
              </thead>
              <tbody>
                ${users
                  .map((user) => {
                    const reportCount = Items.getByUser(user.username).length;
                    return `
                      <tr>
                        <td><strong>${this.escapeHtml(user.fullName)}</strong></td>
                        <td>${this.escapeHtml(user.username)}</td>
                        <td><span class="badge ${user.role === "admin" ? "badge-claimed" : "badge-found"}">${user.role}</span></td>
                        <td>${this.formatDate(user.createdAt)}</td>
                        <td>${reportCount}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ---- Shared: Item Card Component ----
  renderItemCard(item) {
    const user = Auth.getCurrentUser();
    const isOwner = user && user.username === item.reportedBy;
    const isAdmin = Auth.isAdmin();
    const badgeCls = this._badgeClass(item.status);

    // Build linked-item banner
    let linkedBanner = "";
    if (item.status === "found - awaiting claim") {
      linkedBanner = `
        <div class="item-linked-banner awaiting">
          &#127963;&#65039; <strong>Found!</strong> Waiting to be claimed at the Faculty Room / Lost &amp; Found Office.
          ${item.foundByUser ? ` Found by <strong>${this.escapeHtml(item.foundByUser)}</strong>.` : ""}
        </div>`;
    } else if (item.status === "matched") {
      linkedBanner = `
        <div class="item-linked-banner matched">
          &#128279; This found report is linked to a lost item. Item should be at the Faculty Room.
        </div>`;
    } else if (item.status === "claimed") {
      linkedBanner = `
        <div class="item-linked-banner claimed">
          &#9989; <strong>Claimed!</strong> This item has been returned to its owner.
        </div>`;
    }

    // Determine display type label — override for resolved items
    let typeLabel = item.type;
    let typeBadgeClass = `badge-${item.type}`;
    if (item.status === "claimed") {
      typeLabel = "claimed";
      typeBadgeClass = "badge-claimed";
    } else if (item.status === "found - awaiting claim") {
      typeLabel = "awaiting claim";
      typeBadgeClass = "badge-found-awaiting";
    } else if (item.status === "matched") {
      typeLabel = "matched";
      typeBadgeClass = "badge-matched";
    }

    return `
      <div class="item-card${item.status === "claimed" ? " item-card--claimed" : ""}">
        <div class="item-card-header">
          <div>
            <h4>${this.escapeHtml(item.name)}</h4>
            <span class="badge ${typeBadgeClass}" style="margin-top: 0.25rem;">${typeLabel}</span>
          </div>
          <span class="badge badge-${badgeCls}">${item.status}</span>
        </div>
        ${linkedBanner}
        <div class="item-card-body">
          <div class="item-detail">
            <span class="detail-label">&#128197; Date:</span>
            <span class="detail-value">${this.formatDate(item.date)}</span>
          </div>
          <div class="item-detail">
            <span class="detail-label">&#128205; Location:</span>
            <span class="detail-value">${this.escapeHtml(item.location)}</span>
          </div>
          <div class="item-detail">
            <span class="detail-label">&#128196; Category:</span>
            <span class="detail-value">${this.escapeHtml(item.category)}</span>
          </div>
          <div class="item-detail">
            <span class="detail-label">&#128221; Details:</span>
            <span class="detail-value">${this.escapeHtml(item.description)}</span>
          </div>
          ${
            item.contactInfo
              ? `<div class="item-detail">
                  <span class="detail-label">&#128222; Contact:</span>
                  <span class="detail-value">${this.escapeHtml(item.contactInfo)}</span>
                </div>`
              : ""
          }
        </div>
        <div class="item-card-footer">
          <span class="meta">Reported by <strong>${this.escapeHtml(item.reportedBy)}</strong></span>
          ${
            (isOwner || isAdmin) &&
            (item.status === "pending" ||
              item.status === "found - awaiting claim")
              ? `<button class="btn btn-success btn-sm mark-claimed-btn" data-id="${item.id}">&#9989; Mark Claimed</button>`
              : ""
          }
        </div>
      </div>
    `;
  },

  // ---- User Info in Sidebar ----
  updateUserInfo() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const initials = user.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    document.getElementById("user-avatar").textContent = initials;
    document.getElementById("user-name").textContent = user.fullName;
    document.getElementById("user-role").textContent = user.role;
  },

  // ---- Global Event Delegation ----
  initGlobalEvents() {
    // Navigation clicks
    document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
      item.onclick = () => {
        this.navigateTo(item.dataset.page);
        document.querySelector(".sidebar").classList.remove("open");
      };
    });

    // Logout
    document.getElementById("btn-logout").onclick = () => {
      Auth.logout();
      this.showLogin();
      this.showToast("You have been logged out.", "info");
    };

    // Mobile menu toggle
    document.getElementById("menu-toggle").onclick = () => {
      document.querySelector(".sidebar").classList.toggle("open");
    };

    // Global delegation — Mark as Claimed (async)
    document.addEventListener("click", async (e) => {
      if (e.target.classList.contains("mark-claimed-btn")) {
        const id = e.target.dataset.id;
        e.target.disabled = true;
        e.target.textContent = "Saving...";
        const result = await Items.updateStatus(id, "claimed");
        if (result.success) {
          this.showToast(result.message, "success");
          // UI will auto-update via Firebase real-time listener
        } else {
          this.showToast(result.message, "error");
          e.target.disabled = false;
          e.target.innerHTML = "&#9989; Mark Claimed";
        }
      }
    });

    // Close modal on overlay click
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        this.closeModal();
      }
    });
  },

  // ---- Modal ----
  showConfirmModal(message, onConfirm) {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.innerHTML = `
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>Confirm Action</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn-danger" id="modal-confirm-btn">Delete</button>
          </div>
        </div>
      </div>
    `;
    modalContainer.classList.remove("hidden");
    document.getElementById("modal-confirm-btn").onclick = onConfirm;
  },

  closeModal() {
    const modalContainer = document.getElementById("modal-container");
    modalContainer.classList.add("hidden");
    modalContainer.innerHTML = "";
  },

  // ---- Alerts ----
  showAlert(containerId, message, type = "danger") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  },

  clearAlerts() {
    document
      .querySelectorAll('[id$="-alert"]')
      .forEach((el) => (el.innerHTML = ""));
  },

  // ---- Toast Notifications ----
  showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = {
      success: "&#9989;",
      error: "&#10060;",
      info: "&#8505;&#65039;",
    };
    toast.innerHTML = `${icons[type] || ""} ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  // ---- Utility ----
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  // Convert status string to a safe CSS class fragment
  _badgeClass(status) {
    if (!status) return "pending";
    return status.replace(/\s+/g, "-");
  },

  formatDate(dateStr) {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  },
};

// ---- Boot ----
document.addEventListener("DOMContentLoaded", () => {
  App.init();
  App.initGlobalEvents();
});
