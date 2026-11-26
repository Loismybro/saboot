import axios from "axios";

function resolveApiBaseUrl() {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    (window.location.port === "4173" || window.location.port === "5173")
  ) {
    return "http://localhost:5000";
  }
  return "";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error?.response?.data?.error;
    if (serverMessage) {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  }
);

function toPhotoFormData(input, extraFields = {}) {
  if (input instanceof FormData) {
    return input;
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  }

  const files = Array.isArray(input)
    ? input
    : input instanceof FileList
    ? Array.from(input)
    : Array.isArray(input?.photos)
    ? input.photos
    : input?.photos instanceof FileList
    ? Array.from(input.photos)
    : [];

  for (const file of files) {
    formData.append("photos", file);
  }

  return formData;
}

export async function getHealth() {
  const { data } = await api.get("/health");
  return data;
}

export async function seedDemoData() {
  const { data } = await api.post("/api/demo/seed");
  return data;
}

export async function getRepairRates() {
  const { data } = await api.get("/api/demo/rates");
  return data;
}

export async function runOverdueScan() {
  const { data } = await api.post("/api/jobs/run-overdue");
  return data;
}

export async function listRentals() {
  const { data } = await api.get("/api/rentals");
  return data;
}

export async function getRentalById(id) {
  const { data } = await api.get(`/api/rentals/${id}`);
  return data;
}

export async function checkInRental(payload) {
  const formData =
    payload instanceof FormData
      ? payload
      : toPhotoFormData(payload?.photos, {
          title: payload?.title,
          category: payload?.category,
          ownerName: payload?.ownerName,
          renterName: payload?.renterName,
          depositAmount: payload?.depositAmount,
          dueDate: payload?.dueDate,
        });

  const { data } = await api.post("/api/rentals/checkin", formData);
  return data;
}

export async function checkOutRental(id, photosOrFormData) {
  const formData = toPhotoFormData(photosOrFormData);
  const { data } = await api.post(`/api/rentals/${id}/checkout`, formData);
  return data;
}

export async function verifyRentalHash(id) {
  const { data } = await api.get(`/api/rentals/${id}/verify-hash`);
  return data;
}

export async function simulateRentalTamper(id) {
  const { data } = await api.post(`/api/rentals/${id}/simulate-tamper`);
  return data;
}

export async function restoreRentalSeal(id) {
  const { data } = await api.post(`/api/rentals/${id}/restore-seal`);
  return data;
}

export async function getPendingSettlements(status = "ALL") {
  const params = status && status !== "ALL" ? { status } : undefined;
  const { data } = await api.get("/api/settlements/pending", { params });
  return data;
}

export async function decideSettlement(
  id,
  { action, overrideTotalDeduction, note }
) {
  const { data } = await api.patch(`/api/settlements/${id}/decision`, {
    action,
    ...(overrideTotalDeduction !== undefined && overrideTotalDeduction !== null
      ? { overrideTotalDeduction }
      : {}),
    ...(note !== undefined ? { note } : {}),
  });
  return data;
}
