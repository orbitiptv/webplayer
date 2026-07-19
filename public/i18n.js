(function () {
  const DICT = {
    en: {
      app_name: "Orbit TV",
      logout: "Log out",
      edit: "Edit",
      delete: "Delete",
      cancel: "Cancel",
      ok: "OK",
      error_title: "Error",
      error_prefix: "Error: {0}",
      language_menu: "Language",
      choose_language: "Choose language",
      lang_english: "English",
      lang_serbian: "Serbian",

      login_subtitle: "Log in with your Xtream Codes account",
      hint_profile_name: "Profile name (e.g. Home, Work…)",
      hint_server: "Server address (http://server.com:8080)",
      hint_username: "Username",
      hint_password: "Password",
      save_profile_button: "Save profile",
      add_profile_button: "Add profile",
      no_profiles_text: "No saved profiles yet. Add your first Xtream Codes account.",
      edit_profile_title: "Edit profile",
      fill_all_fields: "Please fill in all fields.",
      connecting: "Connecting…",
      wrong_credentials: "Wrong server, username, or password.",
      login_failed_generic: "Login failed. Check the server address and details.",
      login_failed_profile: "Login failed. Check this profile's details.",
      delete_profile_confirm: "Delete this profile?",

      nav_live: "Live TV",
      nav_movies: "Movies",
      nav_series: "Series",
      expand_fullscreen: "Open fullscreen",
      categories_label: "Categories",
      channels_label: "Channels",
      tv_guide_label: "TV Guide",
      live_badge: "LIVE",
      select_channel: "Select a channel",
      loading_program: "Loading program…",
      no_program_info: "No program information",
      epg_unavailable: "Guide unavailable",
      all_channels: "All channels",
      all_label: "All",
      no_channels_category: "No channels in this category.",
      no_movies_category: "No movies in this category.",
      no_series_category: "No series in this category.",
      up_next: "Next",
      now_button: "Now ↦",

      season_label: "Season {0}",
      no_episodes: "No episodes available.",

      playback_speed: "Playback speed",
      audio_track: "Audio track",
      subtitles: "Subtitles",
      subtitles_off: "Off",
      no_subtitles_available: "No subtitles available for this title",
      no_audio_tracks_available: "No alternate audio tracks available",
      track_fallback_label: "Track {0}"
    },
    sr: {
      app_name: "Orbit TV",
      logout: "Odjava",
      edit: "Izmeni",
      delete: "Obriši",
      cancel: "Otkaži",
      ok: "U redu",
      error_title: "Greška",
      error_prefix: "Greška: {0}",
      language_menu: "Jezik",
      choose_language: "Izaberi jezik",
      lang_english: "Engleski",
      lang_serbian: "Srpski",

      login_subtitle: "Prijavite se sa Xtream Codes nalogom",
      hint_profile_name: "Naziv profila (npr. Kuća, Posao…)",
      hint_server: "Adresa servera (http://server.com:8080)",
      hint_username: "Korisničko ime",
      hint_password: "Lozinka",
      save_profile_button: "Sačuvaj profil",
      add_profile_button: "Dodaj profil",
      no_profiles_text: "Nema sačuvanih profila. Dodaj svoj prvi Xtream Codes nalog.",
      edit_profile_title: "Izmeni profil",
      fill_all_fields: "Popuni sva polja.",
      connecting: "Povezivanje…",
      wrong_credentials: "Pogrešan server, korisničko ime ili lozinka.",
      login_failed_generic: "Prijava neuspešna. Proveri adresu servera i podatke.",
      login_failed_profile: "Prijava neuspešna. Proveri podatke profila.",
      delete_profile_confirm: "Obrisati ovaj profil?",

      nav_live: "Uživo TV",
      nav_movies: "Filmovi",
      nav_series: "Serije",
      expand_fullscreen: "Otvori preko celog ekrana",
      categories_label: "Kategorije",
      channels_label: "Kanali",
      tv_guide_label: "TV vodič",
      live_badge: "UŽIVO",
      select_channel: "Izaberi kanal",
      loading_program: "Učitavanje programa…",
      no_program_info: "Nema podataka o programu",
      epg_unavailable: "EPG nedostupan",
      all_channels: "Svi kanali",
      all_label: "Sve",
      no_channels_category: "Nema kanala u ovoj kategoriji.",
      no_movies_category: "Nema filmova u ovoj kategoriji.",
      no_series_category: "Nema serija u ovoj kategoriji.",
      up_next: "Sledeće",
      now_button: "Sada ↦",

      season_label: "Sezona {0}",
      no_episodes: "Nema dostupnih epizoda.",

      playback_speed: "Brzina reprodukcije",
      audio_track: "Audio zapis",
      subtitles: "Titlovi",
      subtitles_off: "Isključeno",
      no_subtitles_available: "Nema dostupnih titlova za ovaj naslov",
      no_audio_tracks_available: "Nema dodatnih audio zapisa",
      track_fallback_label: "Zapis {0}"
    }
  };

  function getLang() {
    return localStorage.getItem('orbittv_lang') || 'en';
  }

  function setLang(lang) {
    localStorage.setItem('orbittv_lang', lang);
    applyI18n();
    if (window.onLanguageChanged) window.onLanguageChanged();
  }

  function t(key, ...args) {
    const lang = getLang();
    let str = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    args.forEach((a, i) => { str = str.replace(`{${i}}`, a); });
    return str;
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  window.I18N = { t, getLang, setLang, applyI18n };
})();
