// Main Application Controller

var App = {
  currentPage: "dashboard",

  // Initialize
  init: function () {
    this._showLoading();
    Storage.init();
    Storage.onReady(async function () {
      await Storage.seedDefaultAdmin();
      App._hideLoading();
      if (Auth.isLoggedIn()) {
        App.showApp();
      } else {
        App.showLogin();
      }
    });
  },

  _showLoading: function () {
    document.getElementById("loading-screen").classList.remove("hidden");
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("app-page").classList.add("hidden");
  },

  _hideLoading: function () {
    document.getElementById("loading-screen").classList.add("hidden");
  },

  // Show Login Page
  showLogin: function () {
    document.getElementById("login-page").classList.remove("hidden");
    document.getElementById("app-page").classList.add("hidden");
    this.initLoginPage();
  },

  // Show Main App
  showApp: function () {
    document.getElementById("login-page").classList.add("hidden");
    document.getElementById("app-page").classList.remove("hidden");
    this.updateUserInfo();
    this.updateSidebar();
    this.navigateTo("dashboard");
  },

  // Login Page Logic
  initLoginPage: function () {
    var loginTab = document.getElementById("tab-login");
    var registerTab = document.getElementById("tab-register");
    var loginForm = document.getElementById("login-form");
    var registerForm = document.getElementById("register-form");

    loginTab.onclick = function () {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
    };

    registerTab.onclick = function () {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerForm.classList.remove("hidden");
      loginForm.classList.add("hidden");
    };

    // Login handler - THIS WORKS
    document.getElementById("form-login").onsubmit = function (e) {
      e.preventDefault();
      var username = document.getElementById("login-username").value.trim();
      var password = document.getElementById("login-password").value;

      if (!username || !password) {
        App.showAlert(
          "login-alert",
          "Please enter both username and password.",
          "danger",
        );
        return;
      }

      var result = Auth.login(username, password);
      if (result.success) {
        App.showApp();
      } else {
        App.showAlert("login-alert", result.message, "danger");
      }
    };

    // Register handler
    document.getElementById("form-register").onsubmit = async function (e) {
      e.preventDefault();
      var fullName = document.getElementById("reg-fullname").value;
      var username = document.getElementById("reg-username").value;
      var password = document.getElementById("reg-password").value;
      var confirm = document.getElementById("reg-confirm").value;

      var btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Creating account...";

      var result = await Auth.register(fullName, username, password, confirm);

      btn.disabled = false;
      btn.textContent = "Create Account";

      if (result.success) {
        App.showApp();
      } else {
        App.showAlert("register-alert", result.message, "danger");
      }
    };
  },

  // Sidebar
  updateSidebar: function () {
    var adminNav = document.getElementById("admin-nav-section");
    if (Auth.isAdmin()) {
      adminNav.classList.remove("hidden");
    } else {
      adminNav.classList.add("hidden");
    }
  },

  navigateTo: function (page) {
    this.currentPage = page;

    // Update active nav
    document.querySelectorAll(".nav-item").forEach(function (el) {
      el.classList.remove("active");
    });
    var activeNav = document.querySelector(
      '.nav-item[data-page="' + page + '"]',
    );
    if (activeNav) activeNav.classList.add("active");

    // Update page title
    var titles = {
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

  renderPage: function (page) {
    var content = document.getElementById("content-area");
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
        content.innerHTML = "";
        break;
      case "all-items":
        content.innerHTML = this.renderAllItems();
        // NOTE: search/filter event binding is missing - broken on purpose
        break;
      case "my-reports":
        content.innerHTML = "";
        break;
      case "admin-manage":
        content.innerHTML = "";
        break;
      case "admin-users":
        content.innerHTML = "";
        break;
      default:
        content.innerHTML = this.renderDashboard();
    }
  },

  // Dashboard - WORKS
  renderDashboard: function () {
    var stats = Items.getStats();
    var recentItems = Items.getAll({}).slice(0, 5);

    return (
      '<div class="stats-grid">' +
      '<div class="stat-card">' +
      '<div class="stat-icon lost">&#128270;</div>' +
      '<div class="stat-info"><h4>' +
      stats.totalLost +
      "</h4><p>Lost Items</p></div>" +
      "</div>" +
      '<div class="stat-card">' +
      '<div class="stat-icon found">&#9989;</div>' +
      '<div class="stat-info"><h4>' +
      stats.totalFound +
      "</h4><p>Found Items</p></div>" +
      "</div>" +
      '<div class="stat-card">' +
      '<div class="stat-icon claimed">&#127873;</div>' +
      '<div class="stat-info"><h4>' +
      stats.claimed +
      "</h4><p>Claimed</p></div>" +
      "</div>" +
      '<div class="stat-card">' +
      '<div class="stat-icon pending">&#9203;</div>' +
      '<div class="stat-info"><h4>' +
      stats.pending +
      "</h4><p>Pending</p></div>" +
      "</div>" +
      "</div>" +
      '<div class="card">' +
      '<div class="card-header"><h3>Recent Reports</h3></div>' +
      '<div class="card-body">' +
      (recentItems.length > 0
        ? '<div class="items-grid">' +
          recentItems
            .map(function (item) {
              return App.renderItemCard(item);
            })
            .join("") +
          "</div>"
        : '<div class="empty-state"><div class="empty-icon">&#128196;</div><h4>No items reported yet</h4><p>Start by reporting a lost or found item.</p></div>') +
      "</div>" +
      "</div>"
    );
  },

  // Report Form
  renderReportForm: function (type) {
    var label = type === "lost" ? "Lost" : "Found";
    var today = new Date().toISOString().split("T")[0];

    return (
      '<div class="card" style="max-width:600px;">' +
      '<div class="card-header"><h3>Report ' +
      label +
      " Item</h3></div>" +
      '<div class="card-body">' +
      '<div id="report-alert"></div>' +
      '<form id="report-form">' +
      '<div class="form-group">' +
      "<label>Item Name *</label>" +
      '<input type="text" id="item-name" class="form-control" placeholder="e.g., Blue Backpack" required>' +
      "</div>" +
      '<div class="form-group">' +
      "<label>Category</label>" +
      '<select id="item-category" class="form-control">' +
      '<option value="electronics">Electronics</option>' +
      '<option value="documents">Documents / IDs</option>' +
      '<option value="bags">Bags / Wallets</option>' +
      '<option value="clothing">Clothing</option>' +
      '<option value="other" selected>Other</option>' +
      "</select>" +
      "</div>" +
      '<div class="form-group">' +
      "<label>Description *</label>" +
      '<textarea id="item-description" class="form-control" rows="3" placeholder="Describe the item..." required></textarea>' +
      "</div>" +
      '<div class="form-row">' +
      '<div class="form-group">' +
      "<label>Date " +
      (type === "lost" ? "Lost" : "Found") +
      " *</label>" +
      '<input type="date" id="item-date" class="form-control" max="' +
      today +
      '" required>' +
      "</div>" +
      '<div class="form-group">' +
      "<label>Location *</label>" +
      '<input type="text" id="item-location" class="form-control" placeholder="e.g., Library" required>' +
      "</div>" +
      "</div>" +
      '<div class="form-group">' +
      "<label>Contact Info (optional)</label>" +
      '<input type="text" id="item-contact" class="form-control" placeholder="Phone or email">' +
      "</div>" +
      '<div class="btn-group">' +
      '<button type="submit" id="report-submit-btn" class="btn btn-primary">Submit Report</button>' +
      '<button type="button" class="btn btn-outline" onclick="App.navigateTo(\'dashboard\')">Cancel</button>' +
      "</div>" +
      "</form>" +
      "</div>" +
      "</div>"
    );
  },

  bindReportFormEvents: function (type) {
    // Only lost form has a handler, but it is BROKEN - shows error
    var form = document.getElementById("report-form");
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var name = document.getElementById("item-name").value;
        var desc = document.getElementById("item-description").value;
        var date = document.getElementById("item-date").value;
        var loc = document.getElementById("item-location").value;

        if (!name || !desc || !date || !loc) {
          App.showAlert(
            "report-alert",
            "Please fill in all required fields.",
            "danger",
          );
          return;
        }

        // Attempt to save but it will fail because Items.reportLost is broken
        var btn = document.getElementById("report-submit-btn");
        btn.disabled = true;
        btn.textContent = "Saving...";

        var result = Items.reportLost({
          name: name,
          category: document.getElementById("item-category").value,
          description: desc,
          date: date,
          location: loc,
          contactInfo: document.getElementById("item-contact").value,
        });

        // result is a Promise but we don't handle it properly - newbie mistake
        // This causes the button to stay disabled and nothing happens
        console.log("Report submitted:", result);
        // forgot to handle the promise - button stays stuck
      };
    }
  },

  // All Items - shows items but search/filter BROKEN
  renderAllItems: function () {
    var allItems = Items.getAll({});

    return (
      '<div class="filter-bar">' +
      '<div class="search-box">' +
      '<input type="text" id="search-input" placeholder="Search items...">' +
      "</div>" +
      '<select id="filter-type" class="filter-select">' +
      '<option value="all">All Types</option>' +
      '<option value="lost">Lost</option>' +
      '<option value="found">Found</option>' +
      "</select>" +
      '<select id="filter-status" class="filter-select">' +
      '<option value="all">All Status</option>' +
      '<option value="pending">Pending</option>' +
      '<option value="claimed">Claimed</option>' +
      "</select>" +
      "</div>" +
      '<div id="items-container" class="items-grid">' +
      (allItems.length > 0
        ? allItems
            .map(function (item) {
              return App.renderItemCard(item);
            })
            .join("")
        : '<div class="empty-state" style="width:100%;"><div class="empty-icon">&#128270;</div><h4>No items found</h4></div>') +
      "</div>"
    );
    // NOTE: No event listeners bound for search/filter - they don't work
  },

  // My Reports - PARTIALLY BROKEN (shows but no actions)
  renderMyReports: function () {
    var user = Auth.getCurrentUser();
    if (!user)
      return '<div class="alert alert-danger">Please log in first.</div>';

    var myItems = Items.getByUser(user.username);

    return (
      '<div class="card">' +
      '<div class="card-header"><h3>Your Reports (' +
      myItems.length +
      ")</h3></div>" +
      '<div class="card-body">' +
      (myItems.length > 0
        ? '<div class="items-grid">' +
          myItems
            .map(function (item) {
              return App.renderItemCard(item);
            })
            .join("") +
          "</div>"
        : '<div class="empty-state"><div class="empty-icon">&#128203;</div><h4>No reports yet</h4><p>You haven\'t reported any items.</p></div>') +
      "</div>" +
      "</div>"
    );
  },

  // Admin Manage - shows table but ACTIONS ARE BROKEN
  renderAdminManage: function () {
    if (!Auth.isAdmin()) {
      return '<div class="alert alert-danger">Access denied.</div>';
    }

    var allItems = Items.getAll({});

    var rows = "";
    if (allItems.length === 0) {
      rows =
        '<tr><td colspan="7" style="text-align:center; color:gray; padding:20px;">No items found.</td></tr>';
    } else {
      allItems.forEach(function (item) {
        rows +=
          "<tr>" +
          "<td><strong>" +
          App.escapeHtml(item.name) +
          '</strong><br><small style="color:gray;">' +
          App.escapeHtml(item.category) +
          "</small></td>" +
          '<td><span class="badge badge-' +
          item.type +
          '">' +
          item.type +
          "</span></td>" +
          "<td>" +
          App.escapeHtml(item.location) +
          "</td>" +
          "<td>" +
          App.formatDate(item.date) +
          "</td>" +
          "<td>" +
          App.escapeHtml(item.reportedBy) +
          "</td>" +
          '<td><span class="badge badge-' +
          App._badgeClass(item.status) +
          '">' +
          item.status +
          "</span></td>" +
          "<td>" +
          '<select class="form-control btn-sm" style="width:auto; padding:3px; font-size:11px;" disabled>' +
          "<option>" +
          item.status +
          "</option>" +
          "</select>" +
          ' <button class="btn btn-danger btn-sm" onclick="alert(\'Delete function not implemented yet\')" title="Delete">&#128465;</button>' +
          "</td>" +
          "</tr>";
      });
    }

    return (
      '<div class="card">' +
      '<div class="card-body" style="padding:0;">' +
      '<div class="table-responsive">' +
      "<table>" +
      "<thead><tr>" +
      "<th>Item</th><th>Type</th><th>Location</th><th>Date</th><th>Reported By</th><th>Status</th><th>Actions</th>" +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  },

  // Admin Users - shows table but read-only
  renderAdminUsers: function () {
    if (!Auth.isAdmin()) {
      return '<div class="alert alert-danger">Access denied.</div>';
    }

    var users = Storage.getUsers();
    var rows = "";

    users.forEach(function (user) {
      rows +=
        "<tr>" +
        "<td><strong>" +
        App.escapeHtml(user.fullName) +
        "</strong></td>" +
        "<td>" +
        App.escapeHtml(user.username) +
        "</td>" +
        "<td>" +
        user.role +
        "</td>" +
        "<td>" +
        App.formatDate(user.createdAt) +
        "</td>" +
        "</tr>";
    });

    return (
      '<div class="card">' +
      '<div class="card-header"><h3>Users (' +
      users.length +
      ")</h3></div>" +
      '<div class="card-body" style="padding:0;">' +
      '<div class="table-responsive">' +
      "<table>" +
      "<thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Registered</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  },

  // Item Card - basic version
  renderItemCard: function (item) {
    return (
      '<div class="item-card">' +
      '<div class="item-card-header">' +
      "<div><h4>" +
      this.escapeHtml(item.name) +
      "</h4>" +
      '<span class="badge badge-' +
      item.type +
      '">' +
      item.type +
      "</span></div>" +
      '<span class="badge badge-' +
      this._badgeClass(item.status) +
      '">' +
      item.status +
      "</span>" +
      "</div>" +
      '<div class="item-card-body">' +
      '<div class="item-detail"><span class="detail-label">Date:</span><span class="detail-value">' +
      this.formatDate(item.date) +
      "</span></div>" +
      '<div class="item-detail"><span class="detail-label">Location:</span><span class="detail-value">' +
      this.escapeHtml(item.location) +
      "</span></div>" +
      '<div class="item-detail"><span class="detail-label">Category:</span><span class="detail-value">' +
      this.escapeHtml(item.category) +
      "</span></div>" +
      '<div class="item-detail"><span class="detail-label">Details:</span><span class="detail-value">' +
      this.escapeHtml(item.description) +
      "</span></div>" +
      "</div>" +
      '<div class="item-card-footer">' +
      '<span class="meta">By: <strong>' +
      this.escapeHtml(item.reportedBy) +
      "</strong></span>" +
      "</div>" +
      "</div>"
    );
  },

  // User Info
  updateUserInfo: function () {
    var user = Auth.getCurrentUser();
    if (!user) return;
    var initials = user.fullName
      .split(" ")
      .map(function (n) {
        return n[0];
      })
      .join("")
      .toUpperCase()
      .slice(0, 2);
    document.getElementById("user-avatar").textContent = initials;
    document.getElementById("user-name").textContent = user.fullName;
    document.getElementById("user-role").textContent = user.role;
  },

  // Global Events
  initGlobalEvents: function () {
    // Nav clicks - WORKS
    document.querySelectorAll(".nav-item[data-page]").forEach(function (item) {
      item.onclick = function () {
        App.navigateTo(item.dataset.page);
      };
    });

    // Logout - works but no toast
    document.getElementById("btn-logout").onclick = function () {
      Auth.logout();
      App.showLogin();
    };

    // Mobile menu - broken (sidebar just hides on mobile, toggle does nothing useful)
    document.getElementById("menu-toggle").onclick = function () {
      // TODO: implement mobile menu toggle
      console.log("menu toggle clicked");
    };
  },

  // Alerts
  showAlert: function (containerId, message, type) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML =
      '<div class="alert alert-' +
      (type || "danger") +
      '">' +
      message +
      "</div>";
  },

  // Utility functions
  escapeHtml: function (text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  _badgeClass: function (status) {
    if (!status) return "pending";
    return status.replace(/\s+/g, "-");
  },

  formatDate: function (dateStr) {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  },
};

// Boot
document.addEventListener("DOMContentLoaded", function () {
  App.init();
  App.initGlobalEvents();
});
