const API_BASE = "/api";
const TOKEN_KEY = "foodnest.authToken";
const USER_KEY = "foodnest.user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function roleLabel(role) {
  if (role === "student") return "Hosteller";
  if (role === "cook") return "Home Cook";
  if (role === "delivery") return "Delivery Agent";
  return role;
}

function pageForRole(role) {
  if (role === "student") return "/student.html";
  if (role === "cook") return "/homecook.html";
  if (role === "delivery") return "/delivery.html";
  return "/Userlogin.html";
}

function coinMarkup(value, options = {}) {
  const label = options.label === undefined ? "" : options.label;
  const compact = options.compact ? " compact" : "";
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : value;
  const labelMarkup = label ? `<span class="coin-label">${label}</span>` : "";
  return `<span class="coin-value${compact}"><img class="coin-icon" src="/nestcoin.svg" alt="NestCoin">${safeValue}${labelMarkup}</span>`;
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function logout() {
  clearSession();
  window.location.href = "/Userlogin.html";
}

async function requireRole(role) {
  const token = getToken();
  if (!token) {
    window.location.href = "/Userlogin.html";
    return null;
  }

  try {
    const data = await apiFetch("/auth/me");
    if (data.user.role !== role) {
      clearSession();
      window.location.href = "/Userlogin.html";
      return null;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch (_error) {
    clearSession();
    window.location.href = "/Userlogin.html";
    return null;
  }
}
