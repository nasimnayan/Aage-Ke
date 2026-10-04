// UI strings. Bangla only where the docs give the wording; any key missing in `bn`
// falls back to English until Nasim supplies the Bangla (see missingBn()).
(function (root) {
  'use strict';
  var S = {
    en: {
      app_name: 'Aage Ke?',
      lang_toggle: 'বাংলা | English',
      pin_title: 'Enter PIN',
      pin_set_title: 'Set a 4-digit PIN',
      pin_wrong: 'Wrong PIN',
      pin_note: 'The PIN locks the screen. Records stay on this phone only.',
      judge_button: 'Try the demo (judges)',
      demo_banner: 'Demo: fictional patients. Real facility numbers are masked.',
      lock: 'Lock',
      tier_red: 'Call now or refer',
      tier_amber: 'Call today',
      tier_green: 'No action needed today',
      nobody_removed: 'Nobody is removed from the list.',
      add_patient: 'Add patient',
      settings: 'My details',
      code: 'Patient code',
      union: 'Union',
      phone: 'Phone',
      onset: 'Fever started on',
      fever_dropped_on: 'Fever came down on',
      save: 'Save',
      cancel: 'Back',
      illness_day: 'Illness day {n}',
      fever_dropped_badge: 'fever down {d}',
      confirmed_signs: 'Confirmed signs',
      none_yet: 'None',
      messages: 'Messages',
      add_message: 'Add message',
      paste_here: 'Paste the SMS here',
      read_message: 'Read message',
      missed_call: 'Missed call received',
      own_note: 'Own note',
      save_note: 'Save note',
      suggested: 'suggested',
      unsure: 'Not sure, check yourself',
      not_understood: 'Did not understand, call them',
      no_warning: 'No warning sign found',
      confirm: 'Confirm',
      reject: 'Reject',
      confirmed: 'confirmed',
      rejected: 'rejected',
      tap_to_confirm: 'Tap ✓ or ✗ on each label. Unconfirmed labels change nothing.',
      done: 'Done',
      call_now: 'Call now',
      visit_today: 'Visit today',
      refer: 'Refer',
      send_sms: 'Send SMS',
      visit_logged: 'Visit logged',
      choose_template: 'Message',
      open_sms_app: 'Open SMS app',
      sms_note: 'You press send in your SMS app.',
      why_red: 'Confirmed warning sign',
      why_not_understood: 'Message not understood',
      why_test: 'Mentions a test report',
      why_missed: 'Missed call not answered',
      why_silent: 'No message today in the critical days',
      no_phone: 'No phone number',
      chcp_name: 'My name',
      clinic_name: 'Community clinic',
      my_phone: 'My phone',
      today: 'today',
      yesterday: 'yesterday',
      gloss: 'English gloss',
      export: 'Export (DHIS2-shaped)',
      straight_line: '{km} km in a straight line',
      number_unverified: 'Number not verified',
      admission_unverified: 'Admission information not verified',
      referral_note: 'Referral note to the facility',
      send_note: 'Send note by SMS',
      copy_note: 'Copy note',
      copied: 'Copied',
      sms_to_family: 'SMS to the family',
      log_refer: 'Mark as referred'
    },
    bn: {
      app_name: 'আগে কে?',
      lang_toggle: 'বাংলা | English',
      nobody_removed: 'কাউকে তালিকা থেকে বাদ দেওয়া হয় না',
      missed_call: 'মিসড কল এসেছে',
      own_note: 'নিজের নোট',
      unsure: 'নিশ্চিত নই — নিজে দেখে নিন',
      not_understood: 'বুঝতে পারিনি — ফোন করুন',
      no_warning: 'কোনো সতর্কসংকেত পাওয়া যায়নি',
      straight_line: 'সরলরেখায় {km} কিমি',
      number_unverified: 'নম্বর যাচাই হয়নি',
      admission_unverified: 'ভর্তির তথ্য যাচাই করা হয়নি'
    }
  };
  var lang = 'bn';

  function t(key, vars) {
    var s = (S[lang] && S[lang][key]) || S.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function setLang(l) { lang = l; document.documentElement.lang = l; }
  function getLang() { return lang; }
  function missingBn() { return Object.keys(S.en).filter(function (k) { return !S.bn[k]; }); }

  root.I18N = { t: t, setLang: setLang, getLang: getLang, missingBn: missingBn, strings: S };
})(this);
