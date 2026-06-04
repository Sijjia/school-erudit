/**
 * Типы заметок-замечаний журнала (EduPage-style плитки с эмодзи).
 * Хранятся в BehaviorIncident.type (string) — совместимо со старыми типами.
 */

export interface NoteType {
  key: string;
  label: string;
  emoji: string;
  color: string; // mantine color
  positive: boolean;
}

export const NOTE_TYPES: NoteType[] = [
  { key: 'good_behavior', label: 'Хорошее поведение', emoji: '💚', color: 'green', positive: true },
  { key: 'bad_behavior', label: 'Плохое поведение', emoji: '🔴', color: 'red', positive: false },
  { key: 'late', label: 'Опоздал на урок', emoji: '⏰', color: 'yellow', positive: false },
  { key: 'no_homework', label: 'Нет домашней работы', emoji: '🎒', color: 'orange', positive: false },
  { key: 'active', label: 'Активный в классе', emoji: '⭐', color: 'teal', positive: true },
  { key: 'helped', label: 'Помогал одноклассникам', emoji: '🐝', color: 'teal', positive: true },
  { key: 'excellent', label: 'Отличная работа', emoji: '😊', color: 'green', positive: true },
  { key: 'can_better', label: 'Можешь лучше', emoji: '😐', color: 'yellow', positive: false },
  { key: 'no_uniform', label: 'Нет формы', emoji: '➖', color: 'gray', positive: false },
  { key: 'phone', label: 'Пользовался телефоном', emoji: '📱', color: 'orange', positive: false },
  { key: 'parent_message', label: 'Сообщение родителю', emoji: '✉️', color: 'blue', positive: false },
  { key: 'wonderful', label: 'Замечательно', emoji: '🍒', color: 'pink', positive: true },
];

/** Старые типы инцидентов → отображение (fallback для существующих записей). */
const LEGACY: Record<string, Pick<NoteType, 'label' | 'emoji' | 'color'>> = {
  aggression: { label: 'Агрессия', emoji: '⚠️', color: 'red' },
  rudeness: { label: 'Грубость', emoji: '⚠️', color: 'red' },
  bullying: { label: 'Буллинг', emoji: '🚨', color: 'red' },
  disruption: { label: 'Срыв урока', emoji: '⚠️', color: 'orange' },
  cheating: { label: 'Списывание', emoji: '📋', color: 'orange' },
  property_damage: { label: 'Порча имущества', emoji: '🔧', color: 'orange' },
  other: { label: 'Другое', emoji: '📝', color: 'gray' },
};

export function noteTypeInfo(type: string): Pick<NoteType, 'label' | 'emoji' | 'color'> {
  const preset = NOTE_TYPES.find((t) => t.key === type);
  if (preset) return preset;
  return LEGACY[type] ?? { label: type, emoji: '📝', color: 'gray' };
}
