export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  LINK = 'link',
  INTERVIEW = 'interview',
}

export type PerspectiveTag = 'elder_wisdom' | 'youth_voice' | 'interview_archive' | 'joint';


// ── Main Content Categories ───────────────────────────────────────────────────
// Organised into 6 thematic domains so feeds can be personalised per user.

export enum ContentCategory {
  // ── Cultural & Heritage ──────────────────────────────────────────────────
  CULTURAL = 'Cultural',
  TRADITIONAL = 'Traditional',
  STORY = 'Story',
  PROVERB = 'Proverb',
  RECIPE = 'Recipe',
  HISTORY = 'History',

  // ── Education & Knowledge ────────────────────────────────────────────────
  EDUCATIONAL = 'Educational',
  TUTORIAL = 'Tutorial',
  SCIENCE = 'Science',
  LANGUAGE_LEARNING = 'LanguageLearning',
  PHILOSOPHY = 'Philosophy',
  SPIRITUALITY = 'Spirituality',

  // ── Lifestyle & Wellness ─────────────────────────────────────────────────
  HEALTH = 'Health',
  SPORTS = 'Sports',
  TRAVEL = 'Travel',
  FASHION = 'Fashion',
  FOOD = 'Food',
  PARENTING = 'Parenting',
  RELATIONSHIPS = 'Relationships',

  // ── Entertainment ────────────────────────────────────────────────────────
  MUSIC = 'Music',
  HUMOR = 'Humor',
  ARTS = 'Arts',
  FILM = 'Film',
  GAMING = 'Gaming',

  // ── Professional & Growth ────────────────────────────────────────────────
  TECH = 'Tech',
  BUSINESS = 'Business',
  CAREER = 'Career',
  FINANCE = 'Finance',

  // ── Social & Community ───────────────────────────────────────────────────
  NEWS = 'News',
  OPINION = 'Opinion',
  COMMUNITY = 'Community',
  ENVIRONMENT = 'Environment',
  POLITICS = 'Politics',
}

// Category groups used for UI rendering (chips, filters, onboarding pickers)
export const CATEGORY_GROUPS: Record<string, ContentCategory[]> = {
  'Cultural & Heritage': [
    ContentCategory.CULTURAL,
    ContentCategory.TRADITIONAL,
    ContentCategory.STORY,
    ContentCategory.PROVERB,
    ContentCategory.RECIPE,
    ContentCategory.HISTORY,
  ],
  'Education & Knowledge': [
    ContentCategory.EDUCATIONAL,
    ContentCategory.TUTORIAL,
    ContentCategory.SCIENCE,
    ContentCategory.LANGUAGE_LEARNING,
    ContentCategory.PHILOSOPHY,
    ContentCategory.SPIRITUALITY,
  ],
  'Lifestyle & Wellness': [
    ContentCategory.HEALTH,
    ContentCategory.SPORTS,
    ContentCategory.TRAVEL,
    ContentCategory.FASHION,
    ContentCategory.FOOD,
    ContentCategory.PARENTING,
    ContentCategory.RELATIONSHIPS,
  ],
  'Entertainment': [
    ContentCategory.MUSIC,
    ContentCategory.HUMOR,
    ContentCategory.ARTS,
    ContentCategory.FILM,
    ContentCategory.GAMING,
  ],
  'Professional & Growth': [
    ContentCategory.TECH,
    ContentCategory.BUSINESS,
    ContentCategory.CAREER,
    ContentCategory.FINANCE,
  ],
  'Social & Community': [
    ContentCategory.NEWS,
    ContentCategory.OPINION,
    ContentCategory.COMMUNITY,
    ContentCategory.ENVIRONMENT,
    ContentCategory.POLITICS,
  ],
};

// ── Cultural Sub-Categories ───────────────────────────────────────────────────
// Used specifically for Story/Knowledge items with a cultural dimension.
export enum CulturalCategory {
  TALE = 'tale',
  PROVERB = 'proverb',
  RECIPE = 'recipe',
  LIFE_LESSON = 'life_lesson',
  TRADITIONAL_SONG = 'traditional_song',
  HISTORY = 'history',
  RITUAL = 'ritual',
  CEREMONY = 'ceremony',
  LANGUAGE = 'language',
  CRAFT = 'craft',
  MYTHOLOGY = 'mythology',
  MEDICINE = 'traditional_medicine',
}

export interface FileMetadata {
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface Comment {
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
  likes: string[];
}

export interface Reaction {
  type: 'like' | 'love' | 'clap' | 'insightful' | 'thankful';
  userIds: string[];
}