import type { ReminderKey, ReminderLanguage } from '../ai/AIProvider.js';

type Message = { subject: string; body: string };
type Translation = Record<ReminderKey, Message>;

const english: Translation = {
  DOSE_UPCOMING: { subject: 'Upcoming dose: {{medicine}} ({{dosage}})', body: 'Hello {{name}},\n\nIt is almost time for {{medicine}} ({{dosage}}). {{instructions}}\nPlease use CareSync to record the dose.' },
  DOSE_MISSED: { subject: 'Missed dose: {{medicine}}', body: 'Hello {{name}},\n\nThe dose of {{medicine}} ({{dosage}}) scheduled for {{time}} is marked missed. If it was taken, please update the record in CareSync.' },
  DOSE_ESCALATION: { subject: 'Dose check-in: {{name}}', body: '{{name}} has not recorded {{medicine}} ({{dosage}}), scheduled for {{time}}. Please check in with them.' },
  DOSE_ALL_CLEAR: { subject: 'Dose recorded: {{name}}', body: '{{name}} has now recorded {{medicine}} ({{dosage}}), previously overdue. The CareSync dose record is up to date.' },
  APPOINTMENT_DAY_BEFORE: { subject: 'Tomorrow: {{appointment}}', body: '{{name}} has an appointment tomorrow.\nTitle: {{appointment}}\nDoctor: {{doctor}}\nLocation: {{location}}\nTime: {{time}}\n{{notes}}' },
  APPOINTMENT_TWO_HOUR: { subject: 'Appointment in about two hours: {{appointment}}', body: '{{name}} has an appointment in about two hours.\nTitle: {{appointment}}\nLocation: {{location}}\nDoctor: {{doctor}}\nTime: {{time}}' },
  PROPOSAL_NEEDS_APPROVAL: { subject: 'Medicine proposal needs your review: {{medicine}}', body: 'Hello {{name}},\n\nA caretaker proposed adding or updating {{medicine}}. It will not be added to the schedule until you approve it in CareSync.' },
  REFILL_WARNING: { subject: 'Refill reminder: {{medicine}}', body: '{{name}} has about {{days}} days of {{medicine}} ({{dosage}}) remaining, with {{stock}} pills in stock. Please review the supply.' },
};

// NEEDS NATIVE SPEAKER REVIEW before production use. Keep message keys and {{placeholders}} aligned with English.
const hindi: Translation = {
  DOSE_UPCOMING: { subject: 'दवा का समय: {{medicine}} ({{dosage}})', body: 'नमस्ते {{name}},\n\n{{medicine}} ({{dosage}}) लेने का समय लगभग हो गया है। {{instructions}}\nकृपया खुराक दर्ज करने के लिए CareSync का उपयोग करें।' },
  DOSE_MISSED: { subject: 'छूटी हुई खुराक: {{medicine}}', body: 'नमस्ते {{name}},\n\n{{time}} पर तय {{medicine}} ({{dosage}}) की खुराक छूटी हुई दर्ज है। यदि खुराक ली गई है, तो CareSync में रिकॉर्ड अपडेट करें।' },
  DOSE_ESCALATION: { subject: 'खुराक के बारे में पूछताछ: {{name}}', body: '{{name}} ने {{time}} पर तय {{medicine}} ({{dosage}}) दर्ज नहीं की है। कृपया उनसे संपर्क करें।' },
  DOSE_ALL_CLEAR: { subject: 'खुराक दर्ज हुई: {{name}}', body: '{{name}} ने पहले देर हुई {{medicine}} ({{dosage}}) की खुराक अब दर्ज कर दी है। CareSync रिकॉर्ड अपडेट है।' },
  APPOINTMENT_DAY_BEFORE: { subject: 'कल की मुलाकात: {{appointment}}', body: '{{name}} की मुलाकात कल है।\nशीर्षक: {{appointment}}\nडॉक्टर: {{doctor}}\nस्थान: {{location}}\nसमय: {{time}}\n{{notes}}' },
  APPOINTMENT_TWO_HOUR: { subject: 'लगभग दो घंटे में मुलाकात: {{appointment}}', body: '{{name}} की मुलाकात लगभग दो घंटे में है।\nशीर्षक: {{appointment}}\nस्थान: {{location}}\nडॉक्टर: {{doctor}}\nसमय: {{time}}' },
  PROPOSAL_NEEDS_APPROVAL: { subject: 'दवा के प्रस्ताव की समीक्षा करें: {{medicine}}', body: 'नमस्ते {{name}},\n\nदेखभालकर्ता ने {{medicine}} जोड़ने या बदलने का प्रस्ताव दिया है। CareSync में आपकी मंज़ूरी से पहले यह दवा सूची में नहीं जोड़ी जाएगी।' },
  REFILL_WARNING: { subject: 'दवा फिर से लेने की याद: {{medicine}}', body: '{{name}} के पास {{medicine}} ({{dosage}}) की लगभग {{days}} दिन की आपूर्ति और {{stock}} गोलियाँ बची हैं। कृपया आपूर्ति की जाँच करें।' },
};

// NEEDS NATIVE SPEAKER REVIEW before production use. Keep message keys and {{placeholders}} aligned with English.
const kannada: Translation = {
  DOSE_UPCOMING: { subject: 'ಔಷಧಿ ಸಮಯ: {{medicine}} ({{dosage}})', body: 'ನಮಸ್ಕಾರ {{name}},\n\n{{medicine}} ({{dosage}}) ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ. {{instructions}}\nಡೋಸ್ ದಾಖಲಿಸಲು CareSync ಬಳಸಿ.' },
  DOSE_MISSED: { subject: 'ತಪ್ಪಿದ ಡೋಸ್: {{medicine}}', body: 'ನಮಸ್ಕಾರ {{name}},\n\n{{time}}ಕ್ಕೆ ನಿಗದಿಯಾದ {{medicine}} ({{dosage}}) ಡೋಸ್ ತಪ್ಪಿದಂತೆ ಗುರುತಿಸಲಾಗಿದೆ. ತೆಗೆದುಕೊಂಡಿದ್ದರೆ CareSync ನಲ್ಲಿ ದಾಖಲೆಯನ್ನು ನವೀಕರಿಸಿ.' },
  DOSE_ESCALATION: { subject: 'ಡೋಸ್ ಕುರಿತು ವಿಚಾರಣೆ: {{name}}', body: '{{name}} ಅವರು {{time}}ಕ್ಕೆ ನಿಗದಿಯಾದ {{medicine}} ({{dosage}}) ದಾಖಲಿಸಿಲ್ಲ. ದಯವಿಟ್ಟು ಅವರೊಂದಿಗೆ ವಿಚಾರಿಸಿ.' },
  DOSE_ALL_CLEAR: { subject: 'ಡೋಸ್ ದಾಖಲಿಸಲಾಗಿದೆ: {{name}}', body: '{{name}} ಅವರು ಹಿಂದೆ ಬಾಕಿ ಇದ್ದ {{medicine}} ({{dosage}}) ಡೋಸ್ ಅನ್ನು ಈಗ ದಾಖಲಿಸಿದ್ದಾರೆ. CareSync ದಾಖಲೆ ನವೀಕೃತವಾಗಿದೆ.' },
  APPOINTMENT_DAY_BEFORE: { subject: 'ನಾಳೆ ಭೇಟಿ: {{appointment}}', body: '{{name}} ಅವರಿಗೆ ನಾಳೆ ಭೇಟಿ ಇದೆ.\nಶೀರ್ಷಿಕೆ: {{appointment}}\nವೈದ್ಯರು: {{doctor}}\nಸ್ಥಳ: {{location}}\nಸಮಯ: {{time}}\n{{notes}}' },
  APPOINTMENT_TWO_HOUR: { subject: 'ಸುಮಾರು ಎರಡು ಗಂಟೆಯಲ್ಲಿ ಭೇಟಿ: {{appointment}}', body: '{{name}} ಅವರ ಭೇಟಿ ಸುಮಾರು ಎರಡು ಗಂಟೆಯಲ್ಲಿ ಇದೆ.\nಶೀರ್ಷಿಕೆ: {{appointment}}\nಸ್ಥಳ: {{location}}\nವೈದ್ಯರು: {{doctor}}\nಸಮಯ: {{time}}' },
  PROPOSAL_NEEDS_APPROVAL: { subject: 'ಔಷಧಿ ಪ್ರಸ್ತಾಪ ಪರಿಶೀಲಿಸಿ: {{medicine}}', body: 'ನಮಸ್ಕಾರ {{name}},\n\nಪಾಲಕರು {{medicine}} ಸೇರಿಸಲು ಅಥವಾ ಬದಲಾಯಿಸಲು ಪ್ರಸ್ತಾಪಿಸಿದ್ದಾರೆ. CareSync ನಲ್ಲಿ ನೀವು ಅನುಮೋದಿಸುವವರೆಗೆ ಇದು ವೇಳಾಪಟ್ಟಿಗೆ ಸೇರುವುದಿಲ್ಲ.' },
  REFILL_WARNING: { subject: 'ಔಷಧಿ ಮರುಪೂರಣ ನೆನಪಿನ ಸೂಚನೆ: {{medicine}}', body: '{{name}} ಅವರ ಬಳಿ {{medicine}} ({{dosage}}) ಸುಮಾರು {{days}} ದಿನಕ್ಕೆ ಸಾಕಾಗುವಷ್ಟು ಮತ್ತು {{stock}} ಮಾತ್ರೆಗಳಿವೆ. ದಯವಿಟ್ಟು ಪೂರೈಕೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.' },
};

const catalogs: Record<ReminderLanguage, Translation> = { ENGLISH: english, HINDI: hindi, KANNADA: kannada };
export function getReminderText(key: ReminderKey, language: string | null | undefined, values: Record<string, string | number>): Message {
  const lang: ReminderLanguage = language === 'HINDI' || language === 'KANNADA' ? language : 'ENGLISH';
  const selected = catalogs[lang][key] ?? english[key];
  const render = (input: string) => input.replace(/{{(\w+)}}/g, (_match, name: string) => String(values[name] ?? ''));
  return { subject: render(selected.subject), body: render(selected.body) };
}
