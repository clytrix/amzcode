export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = any;
type DefaultSchema = any;
export type Tables<T, N = never> = any;
export type TablesInsert<T, N = never> = any;
export type TablesUpdate<T, N = never> = any;
export type Enums<T, N = never> = any;
export type CompositeTypes<T, N = never> = any;
export const Constants = { public: { Enums: {} } } as const;