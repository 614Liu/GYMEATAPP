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

/** 新增一条记录时由界面提供的部分，其余字段（id、时间、餐次、换算基准）由 createFoodItem 补齐 */
export type NewFood = Omit<FoodItem, 'id' | 'timestamp' | 'mealType' | 'amountValue' | 'baseNutrition'>;

/** 云端一条饮食记录 = 一个文档，带上所属日期 */
export interface StoredFood extends FoodItem {
  date: string; // YYYY-MM-DD
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
