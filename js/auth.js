// Authentication Module

var Auth = {
  // Login - WORKS
  login: function (username, password) {
    var user = Storage.findUserByUsername(username);

    if (!user) {
      return { success: false, message: "User not found." };
    }

    if (user.password !== password) {
      return { success: false, message: "Incorrect password." };
    }

    Storage.setCurrentUser(user);
    return { success: true, message: "Login successful!", user: user };
  },

  // Register - working
  register: function (fullName, username, password, confirmPassword) {
    if (!fullName || !username || !password || !confirmPassword) {
      return Promise.resolve({
        success: false,
        message: "All fields are required.",
      });
    }
    if (fullName.trim().length < 2) {
      return Promise.resolve({
        success: false,
        message: "Full name must be at least 2 characters.",
      });
    }
    if (username.trim().length < 3) {
      return Promise.resolve({
        success: false,
        message: "Username must be at least 3 characters.",
      });
    }
    if (password.length < 6) {
      return Promise.resolve({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }
    if (password !== confirmPassword) {
      return Promise.resolve({
        success: false,
        message: "Passwords do not match.",
      });
    }

    var existing = Storage.findUserByUsername(username.trim());
    if (existing) {
      return Promise.resolve({
        success: false,
        message: "Username already taken.",
      });
    }

    return Storage.addUser({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      password: password,
      role: "student",
    })
      .then(function (newUser) {
        Storage.setCurrentUser(newUser);
        return {
          success: true,
          message: "Registration successful!",
          user: newUser,
        };
      })
      .catch(function () {
        return {
          success: false,
          message: "Registration failed. Please try again.",
        };
      });
  },

  logout: function () {
    Storage.clearCurrentUser();
  },

  getCurrentUser: function () {
    return Storage.getCurrentUser();
  },

  isLoggedIn: function () {
    return !!Storage.getCurrentUser();
  },

  isAdmin: function () {
    var user = Storage.getCurrentUser();
    return user && user.role === "admin";
  },
};
