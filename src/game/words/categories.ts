export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Premium-only categories can also be toggled remotely via `app_config`. */
  isPremium: boolean;
  sortOrder: number;
}

/**
 * Built-in categories. New categories are added by inserting a row into the
 * `categories` table (admin dashboard) plus words — the app reads both from
 * the backend when it is configured, so no app release is required.
 */
export const BUILT_IN_CATEGORIES: CategoryInfo[] = [
  { id: 'animals', name: 'Animals', icon: '🦊', color: '#FF9F43', isPremium: false, sortOrder: 1 },
  { id: 'food', name: 'Food & Drinks', icon: '🍕', color: '#FF6B6B', isPremium: false, sortOrder: 2 },
  { id: 'countries', name: 'Countries', icon: '🌍', color: '#1DD1A1', isPremium: false, sortOrder: 3 },
  { id: 'cities', name: 'Cities', icon: '🏙️', color: '#54A0FF', isPremium: false, sortOrder: 4 },
  { id: 'technology', name: 'Technology', icon: '💻', color: '#5F27CD', isPremium: false, sortOrder: 5 },
  { id: 'science', name: 'Science', icon: '🔬', color: '#00D2D3', isPremium: false, sortOrder: 6 },
  { id: 'education', name: 'Education', icon: '🎓', color: '#FECA57', isPremium: false, sortOrder: 7 },
  { id: 'sports', name: 'Sports', icon: '⚽', color: '#10AC84', isPremium: false, sortOrder: 8 },
  { id: 'nature', name: 'Nature', icon: '🌿', color: '#2ECC71', isPremium: false, sortOrder: 9 },
  { id: 'business', name: 'Business', icon: '💼', color: '#576574', isPremium: false, sortOrder: 10 },
  { id: 'general', name: 'General Knowledge', icon: '💡', color: '#F368E0', isPremium: false, sortOrder: 11 },
  { id: 'entertainment', name: 'Movies & Entertainment', icon: '🎬', color: '#EE5253', isPremium: false, sortOrder: 12 },
];
