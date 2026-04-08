function normalizeCuisine(value = "") {
  return value.trim().toLowerCase();
}

function southIndianTemplates() {
  return [
    {
      name: "Masala Dosa",
      category: "South Indian",
      priceNestCoins: 60,
      preparationTimeMins: 20,
      imageUrl: "https://i.ibb.co/cXSYd7Xs/food-9.jpg",
      description: "Crisp dosa served with chutney and sambar."
    },
    {
      name: "Idli Sambar",
      category: "South Indian",
      priceNestCoins: 40,
      preparationTimeMins: 15,
      imageUrl: "https://i.ibb.co/mCJsHCYF/food-15.jpg",
      description: "Soft idlis with hot sambar and coconut chutney."
    },
    {
      name: "Curd Rice",
      category: "South Indian",
      priceNestCoins: 45,
      preparationTimeMins: 10,
      imageUrl: "https://i.ibb.co/c7MPFkf/food-2.jpg",
      description: "Comforting curd rice finished with simple tempering."
    },
    {
      name: "Lemon Rice Combo",
      category: "South Indian",
      priceNestCoins: 55,
      preparationTimeMins: 15,
      imageUrl: "https://i.ibb.co/R4CvzqjQ/food-12.jpg",
      description: "Tangy lemon rice with papad and chutney."
    }
  ];
}

function northIndianTemplates() {
  return [
    {
      name: "Veg Thali",
      category: "North Indian",
      priceNestCoins: 70,
      preparationTimeMins: 25,
      imageUrl: "https://i.ibb.co/GQgWYnKP/food-16.jpg",
      description: "Roti, sabzi, dal, rice, and salad in one filling meal."
    },
    {
      name: "Rajma Chawal",
      category: "North Indian",
      priceNestCoins: 62,
      preparationTimeMins: 25,
      imageUrl: "https://i.ibb.co/KzccQY4F/food-8.jpg",
      description: "Home-style rajma served with steamed rice."
    },
    {
      name: "Chole Bhature",
      category: "North Indian",
      priceNestCoins: 68,
      preparationTimeMins: 30,
      imageUrl: "https://i.ibb.co/Z64Mj69g/food-4.jpg",
      description: "Spiced chole with fluffy bhature."
    },
    {
      name: "Aloo Paratha",
      category: "North Indian",
      priceNestCoins: 50,
      preparationTimeMins: 20,
      imageUrl: "https://i.ibb.co/zVtwgyH8/food-7.jpg",
      description: "Stuffed paratha served with curd and pickle."
    }
  ];
}

function snackTemplates() {
  return [
    {
      name: "Paneer Roll",
      category: "Snacks",
      priceNestCoins: 48,
      preparationTimeMins: 15,
      imageUrl: "https://i.ibb.co/Jw5kTh8c/food-14.jpg",
      description: "Soft roll filled with paneer and crunchy vegetables."
    },
    {
      name: "Maggie Masala Bowl",
      category: "Snacks",
      priceNestCoins: 35,
      preparationTimeMins: 10,
      imageUrl: "https://i.ibb.co/LdRbXZbv/food-1.jpg",
      description: "Quick masala noodles topped with fresh herbs."
    },
    {
      name: "Poha",
      category: "Snacks",
      priceNestCoins: 32,
      preparationTimeMins: 12,
      imageUrl: "https://i.ibb.co/v40TYSJS/food-3.jpg",
      description: "Light poha with peanuts and lemon."
    },
    {
      name: "Mini Tiffin Combo",
      category: "Snacks",
      priceNestCoins: 42,
      preparationTimeMins: 15,
      imageUrl: "https://i.ibb.co/HDJNRKC7/food-13.jpg",
      description: "A small snack combo perfect for evenings."
    }
  ];
}

function defaultTemplates() {
  return [
    {
      name: "Healthy Veg Bowl",
      category: "Fresh",
      priceNestCoins: 58,
      preparationTimeMins: 20,
      imageUrl: "https://i.ibb.co/B2WKYk9L/food-10.jpg",
      description: "Balanced meal bowl with rice, curry, and vegetables."
    },
    {
      name: "Veg Fried Rice",
      category: "Fresh",
      priceNestCoins: 55,
      preparationTimeMins: 18,
      imageUrl: "https://i.ibb.co/BJpQ05W/food-5.jpg",
      description: "Wok-tossed fried rice with fresh vegetables."
    },
    {
      name: "Egg Curry Meal",
      category: "Fresh",
      priceNestCoins: 62,
      preparationTimeMins: 22,
      imageUrl: "https://i.ibb.co/HLycpjG7/food-6.jpg",
      description: "Egg curry served with rice and salad."
    },
    {
      name: "Chicken Rice Bowl",
      category: "Fresh",
      priceNestCoins: 74,
      preparationTimeMins: 25,
      imageUrl: "https://i.ibb.co/KcRjxfxX/food-11.jpg",
      description: "Protein-rich bowl with chicken and seasoned rice."
    }
  ];
}

function getStarterMenusForCuisine(cuisine) {
  const normalized = normalizeCuisine(cuisine);

  if (normalized.includes("south")) return southIndianTemplates();
  if (normalized.includes("north") || normalized.includes("punjabi")) return northIndianTemplates();
  if (normalized.includes("snack") || normalized.includes("chaat") || normalized.includes("street")) return snackTemplates();
  return defaultTemplates();
}

module.exports = { getStarterMenusForCuisine };
