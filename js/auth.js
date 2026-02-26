// ===== Authentication Module =====
// login() is synchronous (reads from in-memory cache).
// register() is async (writes to Firebase Realtime DB).

const Auth = {
  // Synchronous login — checks in-memory users cache
  login(username, password) {
    const user = Storage.findUserByUsername(username);

    if (!user) {
      return {
        success: false,
        message: "User not found. Please check your username.",
      };
    }

    if (user.password !== password) {
      return {
        success: false,
        message: "Incorrect password. Please try again.",
      };
    }

    Storage.setCurrentUser(user);
    return { success: true, message: "Login successful!", user };
  },

  // Async register — writes new user to Firebase Realtime DB
  // Returns Promise<{ success, message, user? }>
  register(fullName, username, password, confirmPassword) {
    // Validation (return instantly for invalid input)
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

    const existing = Storage.findUserByUsername(username.trim());
    if (existing) {
      return Promise.resolve({
        success: false,
        message: "Username already taken. Please choose another.",
      });
    }

    return Storage.addUser({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      password: password,
      role: "student",
    })
      .then((newUser) => {
        Storage.setCurrentUser(newUser);
        return {
          success: true,
          message: "Registration successful! Welcome aboard.",
          user: newUser,
        };
      })
      .catch(() => ({
        success: false,
        message: "Registration failed. Please try again.",
      }));
  },

  logout() {
    Storage.clearCurrentUser();
  },

  getCurrentUser() {
    return Storage.getCurrentUser();
  },

  isLoggedIn() {
    return !!Storage.getCurrentUser();
  },

  isAdmin() {
    const user = Storage.getCurrentUser();
    return user && user.role === "admin";
  },
};
