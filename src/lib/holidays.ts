import type { Settings } from '../types';

type HolidayValue = string | { name: string; bangkok: true };

/**
 * Bank of Thailand financial institutions' holidays, from the official notifications.
 * Update this table when the BOT announces a new year (usually in August):
 * https://www.bot.or.th/en/financial-institutions-holiday.html
 */
export const BOT_HOLIDAYS: { sources: Record<string, string>; days: Record<string, HolidayValue> } = {
  sources: {
    '2026': 'BOT Notification No. 31/2568 and No. 26/2569',
    '2027': 'BOT Notification No. 37/2569',
  },
  days: {
    '2026-01-01': 'New Year’s Day',
    '2026-01-02': 'Additional special holiday',
    '2026-03-03': 'Makha Bucha Day',
    '2026-04-06': 'Chakri Memorial Day',
    '2026-04-13': 'Songkran Festival',
    '2026-04-14': 'Songkran Festival',
    '2026-04-15': 'Songkran Festival',
    '2026-05-01': 'National Labour Day',
    '2026-05-04': 'Coronation Day',
    '2026-06-01': 'Substitution for Visakha Bucha Day',
    '2026-06-03': 'H.M. Queen Suthida’s Birthday',
    '2026-07-28': 'H.M. King Maha Vajiralongkorn’s Birthday',
    '2026-07-29': 'Asarnha Bucha Day',
    '2026-08-12': 'H.M. Queen Sirikit the Queen Mother’s Birthday and Mother’s Day',
    '2026-10-13': 'H.M. King Bhumibol Adulyadej the Great Memorial Day',
    '2026-10-16': { name: 'Additional special holiday (Bangkok only)', bangkok: true },
    '2026-10-23': 'H.M. King Chulalongkorn the Great Memorial Day',
    '2026-12-07': 'Substitution for National Day and Father’s Day',
    '2026-12-10': 'Constitution Day',
    '2026-12-31': 'New Year’s Eve',
    '2027-01-01': 'New Year’s Day',
    '2027-02-22': 'Substitution for Makha Bucha Day',
    '2027-04-06': 'Chakri Memorial Day',
    '2027-04-13': 'Songkran Festival',
    '2027-04-14': 'Songkran Festival',
    '2027-04-15': 'Songkran Festival',
    '2027-05-03': 'Substitution for National Labour Day',
    '2027-05-04': 'Coronation Day',
    '2027-05-20': 'Visakha Bucha Day',
    '2027-06-03': 'H.M. Queen Suthida’s Birthday',
    '2027-07-19': 'Substitution for Asarnha Bucha Day',
    '2027-07-28': 'H.M. King Maha Vajiralongkorn’s Birthday',
    '2027-08-12': 'H.M. Queen Sirikit the Queen Mother’s Birthday and Mother’s Day',
    '2027-10-13': 'H.M. King Bhumibol Adulyadej the Great Memorial Day',
    '2027-10-25': 'Substitution for King Chulalongkorn the Great Memorial Day',
    '2027-12-06': 'Substitution for National Day and Father’s Day',
    '2027-12-10': 'Constitution Day',
    '2027-12-31': 'New Year’s Eve',
  },
};

export interface HolidayInfo {
  name: string;
  source: 'bot' | 'custom';
}

type HolidaySettings = Pick<Settings, 'customHolidays' | 'useBotHolidays' | 'botBangkok'>;

export function holidayInfo(settings: HolidaySettings, key: string): HolidayInfo | null {
  const custom = settings.customHolidays.find((c) => c.date === key);
  if (custom) return { name: custom.name || 'Holiday', source: 'custom' };
  if (!settings.useBotHolidays) return null;
  const v = BOT_HOLIDAYS.days[key];
  if (!v) return null;
  if (typeof v === 'object') return settings.botBangkok ? { name: v.name, source: 'bot' } : null;
  return { name: v, source: 'bot' };
}

export const holidayName = (settings: HolidaySettings, key: string): string => holidayInfo(settings, key)?.name ?? '';
