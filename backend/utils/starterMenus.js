function normalizeCuisine(value = "") {
  return value.trim().toLowerCase();
}

function getStarterMenuIdsForCuisine(cuisine) {
  const normalized = normalizeCuisine(cuisine);

  if (normalized.includes("south")) {
    return ["hostel-meal-02", "hostel-meal-09", "hostel-meal-12", "hostel-meal-15"];
  }

  if (normalized.includes("north") || normalized.includes("punjabi")) {
    return ["hostel-meal-04", "hostel-meal-07", "hostel-meal-08", "hostel-meal-16"];
  }

  if (normalized.includes("snack") || normalized.includes("chaat") || normalized.includes("street")) {
    return ["hostel-meal-01", "hostel-meal-03", "hostel-meal-13", "hostel-meal-14"];
  }

  return ["hostel-meal-05", "hostel-meal-06", "hostel-meal-10", "hostel-meal-11"];
}

module.exports = { getStarterMenuIdsForCuisine };
