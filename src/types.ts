export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface LibraryFood {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  createdAt?: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: string; // e.g., "100g", "1 piece"
  amountValue: number; // numeric value for editing
  baseNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    unit: 'g' | 'unit';
  };
  timestamp: number;
  mealType?: MealType;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  foods: FoodItem[];
}

export interface WeightLog {
  date: string;
  weight: number;
}

export interface WaterLog {
  date: string;
  amount: number; // in ml
}
