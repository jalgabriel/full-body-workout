/* Main JS for 1&1 Workout App — complete & robust version */
document.addEventListener('DOMContentLoaded', () => {
   // NAV TOGGLE (accessible)
   const navToggle = document.querySelector('.nav-toggle');
   const navList = document.querySelector('.nav-list');

   function closeNav() {
      if (!navToggle || !navList) return;
      navList.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
   }

   function openNav() {
      if (!navToggle || !navList) return;
      navList.classList.add('open');
      navToggle.setAttribute('aria-expanded', 'true');
   }

   if (navToggle && navList) {
      navToggle.addEventListener('click', () => {
         const expanded = navToggle.getAttribute('aria-expanded') === 'true';
         expanded ? closeNav() : openNav();
      });

      // Close nav on Escape
      document.addEventListener('keydown', (e) => {
         if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
            closeNav();
         }
      });

      // Close nav when clicking outside
      document.addEventListener('click', (e) => {
         if (!navList.contains(e.target) && !navToggle.contains(e.target) && navToggle.getAttribute('aria-expanded') === 'true') {
            closeNav();
         }
      });

      // Close nav when clicking a nav link
      navList.querySelectorAll('a').forEach(link => {
         link.addEventListener('click', () => {
            closeNav();
         });
      });
   }

   // --- SELECTORS ---
   const selectButtons = document.querySelectorAll('.select-level');
   const levelSelect = document.getElementById('challenge-level');
   const GRID = document.getElementById('challenge-grid');
   const RESET = document.getElementById('reset-challenge');
   const DAY_LOG = document.getElementById('day-log');
   const DAY_NUMBER = document.getElementById('day-number');
   const NOTES = document.getElementById('notes');
   const SAVE_LOG = document.getElementById('save-log');
   const CANCEL_LOG = document.getElementById('cancel-log');

   if (!GRID) return; // nothing to do if challenge area missing

   // Create (or reuse) a progress container placed above the grid
   let progressContainer = document.getElementById('challenge-progress');

   if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'challenge-progress';
      progressContainer.className = 'challenge-progress';
      progressContainer.innerHTML = `
         <div class="progress-text" aria-live="polite"></div>
         <div class="progress-bar-wrap" aria-hidden="true">
         <div class="progress-bar" style="height:8px;border-radius:6px;background:linear-gradient(90deg, #e63946, #ff7b7b);width:0%"></div>
         </div>
      `;
      GRID.parentNode.insertBefore(progressContainer, GRID);
   }

   const progressText = progressContainer.querySelector('.progress-text');
   const progressBar = progressContainer.querySelector('.progress-bar');

   // --- state and storage ---
   const STORAGE_KEY = 'oneandone_challenge_v1';
   let state = { level: null, days: [] };
   let currentDayIndex = null;

   function hasLocalStorage() {
      try { 
         const t = '__st__'; localStorage.setItem(t, t); localStorage.removeItem(t); return true; 
      } catch (e) { 
         return false; 
      }
   }

   const useStorage = hasLocalStorage();

   function loadState() {
      if (!useStorage) { 
         state = { level: null, days: [] }; return; 
      }

      try {
         const raw = localStorage.getItem(STORAGE_KEY);
         state = raw ? JSON.parse(raw) : { level: null, days: [] };
         if (!state || typeof state !== 'object') state = { level: null, days: [] };
      } catch (err) {
         console.warn('Failed to load state:', err);
         state = { level: null, days: [] };
         localStorage.removeItem(STORAGE_KEY);
      }
   }

   function saveState() {
      if (!useStorage) return;
      try { 
         localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); 
      } catch (err) { 
         console.warn('Failed to save state:', err); 
      }
   }

   function getSetsForLevel(lvl) {
      // mapping level -> sets
      if (String(lvl) === '1') return 2;
      if (String(lvl) === '2') return 3;
      if (String(lvl) === '3') return 4;
      return 0;
   }

   function initChallenge(chosen) {
      loadState();
      const chosenLevel = chosen || (levelSelect ? levelSelect.value : state.level) || state.level;

      if (!chosenLevel) { 
         renderGrid(); return; 
      }

      // if switching levels and there are completed days, warn the user
      if (state.level && String(state.level) !== String(chosenLevel) && state.days && state.days.some(d => d.done)) {
         const ok = confirm('You already have progress saved. Switching level will keep your existing progress but sets per day may differ. Continue?');
         if (!ok) {
         if (levelSelect) levelSelect.value = state.level || '';
         return;
         }
      }

      state.level = String(chosenLevel);

      // initialize 30 days if missing or wrong length
      if (!Array.isArray(state.days) || state.days.length !== 30) {
         state.days = Array.from({ length: 30 }).map(() => ({ done: false, notes: '', completedAt: null }));
      }

      saveState();
      renderGrid();
   }

   function resetChallenge() {
      const confirmed = confirm('Reset your 30-day challenge progress? This will clear all saved logs.');
      if (!confirmed) return;
      state = { level: null, days: [] };
      saveState();
      if (levelSelect) levelSelect.value = '';
      renderGrid();
   }

   function renderGrid() {
      // clear
      GRID.innerHTML = '';

      // ensure progress header is visible and up-to-date
      if (!state.level) {
         GRID.innerHTML = '<p class="muted">Choose a level to begin the 30-day challenge.</p>';
         updateProgress();
         // remove any level header if present
         const existing = GRID.parentNode.querySelectorAll('.challenge-header');
         existing.forEach(h => h.remove());
         return;
      }

      // render a small header showing the selected level
      let header = GRID.parentNode.querySelector('.challenge-header');
      if (!header) {
         header = document.createElement('div');
         header.className = 'challenge-header';
         GRID.parentNode.insertBefore(header, GRID);
      }

      header.innerHTML = `<p>Selected level: <strong>Level ${state.level} — ${getSetsForLevel(state.level)} sets</strong></p>`;

      // render days
      state.days.forEach((d, i) => {
         const btn = document.createElement('button');
         btn.type = 'button';
         btn.className = 'day';
         
         if (d.done) btn.classList.add('completed');
         if (isTodayIndex(i)) btn.classList.add('today');
         btn.setAttribute('data-index', String(i));
         btn.setAttribute('aria-pressed', String(!!d.done));
         btn.setAttribute('aria-label', `Day ${i+1} ${d.done ? 'completed' : 'not completed'}`);
         btn.innerHTML = `<strong>Day ${i+1}</strong><small>${getSetsForLevel(state.level)} sets</small>`;

         btn.addEventListener('click', (ev) => {
            // ctrl/cmd + click toggles quickly without opening log
            if (ev.metaKey || ev.ctrlKey) {
               toggleDayDone(i);
            } else {
               openDayLog(i);
            }
         });

         btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
               e.preventDefault();
               btn.click();
            }
         });

         GRID.appendChild(btn);
      });

      updateProgress();
   }

   function updateProgress() {
      const completed = Array.isArray(state.days) ? state.days.filter(d => d.done).length : 0;
      const pct = Math.round((completed / 30) * 100);
      progressText.textContent = state.level ? `Progress: ${completed}/30 (${pct}%)` : 'Progress: —';
      progressBar.style.width = state.level ? `${pct}%` : '0%';
      progressBar.setAttribute('role', 'progressbar');
      progressBar.setAttribute('aria-valuemin', '0');
      progressBar.setAttribute('aria-valuemax', '30');
      progressBar.setAttribute('aria-valuenow', String(completed));
   }

   function isTodayIndex(i) {
      if (!Array.isArray(state.days)) return false;
      const firstIncomplete = state.days.findIndex(d => !d.done);
      return firstIncomplete === i;
   }

   function openDayLog(i) {
      currentDayIndex = i;
      DAY_NUMBER.textContent = String(i + 1);
      NOTES.value = state.days[i].notes || '';
      DAY_LOG.classList.remove('hidden');
      DAY_LOG.setAttribute('data-day-index', String(i));

      // create or update toggle button in the log (Mark Done / Mark Undone)
      let toggleBtn = DAY_LOG.querySelector('#toggle-done');
      if (!toggleBtn) {
         toggleBtn = document.createElement('button');
         toggleBtn.id = 'toggle-done';
         toggleBtn.type = 'button';
         toggleBtn.className = 'btn ghost';
         toggleBtn.style.marginLeft = '0.5rem';
         SAVE_LOG.insertAdjacentElement('afterend', toggleBtn);
         toggleBtn.addEventListener('click', () => {
         if (currentDayIndex === null) return;
         state.days[currentDayIndex].done = !state.days[currentDayIndex].done;
         state.days[currentDayIndex].completedAt = state.days[currentDayIndex].done ? new Date().toISOString() : null;
         saveState();
         renderGrid();
         toggleBtn.textContent = state.days[currentDayIndex].done ? 'Mark Undone' : 'Mark Done';
         });
      }

      toggleBtn.textContent = state.days[i].done ? 'Mark Undone' : 'Mark Done';

      // focus textarea for quick notes
      setTimeout(() => NOTES.focus(), 150);
   }

   function closeDayLog() {
      DAY_LOG.classList.add('hidden');
      DAY_LOG.removeAttribute('data-day-index');
      currentDayIndex = null;
   }

   function toggleDayDone(i) {
      if (!Array.isArray(state.days) || !state.days[i]) return;
      state.days[i].done = !state.days[i].done;
      state.days[i].completedAt = state.days[i].done ? new Date().toISOString() : null;
      saveState();
      renderGrid();
   }

   // --- event bindings ---
   if (CANCEL_LOG) {
      CANCEL_LOG.addEventListener('click', (e) => { e.preventDefault(); closeDayLog(); });
   }

   if (SAVE_LOG) {
      SAVE_LOG.addEventListener('click', (e) => {
         e.preventDefault();
         if (currentDayIndex === null) return;
         state.days[currentDayIndex].notes = (NOTES.value || '').trim();
         state.days[currentDayIndex].done = true; // saving marks the day done
         state.days[currentDayIndex].completedAt = state.days[currentDayIndex].completedAt || new Date().toISOString();
         saveState();
         renderGrid();
         closeDayLog();
      });
   }

   // close day log on ESC
   document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
         if (DAY_LOG && !DAY_LOG.classList.contains('hidden')) closeDayLog();
      }
   });

   // select-level card buttons
   if (selectButtons && selectButtons.length) {
      selectButtons.forEach(btn => btn.addEventListener('click', (e) => {
         const lvl = btn.dataset.level;
         if (!lvl) return;
         if (levelSelect) levelSelect.value = lvl;
         initChallenge(lvl);
         document.getElementById('challenge').scrollIntoView({ behavior: 'smooth' });
      }));
   }

   if (levelSelect) {
      levelSelect.addEventListener('change', () => initChallenge());
   }

   if (RESET) {
      RESET.addEventListener('click', () => resetChallenge());
   }

   // initial load & render
   loadState();
   if (state.level && levelSelect) levelSelect.value = state.level;

   if (state.level && (!state.days || state.days.length !== 30)) {
      state.days = Array.from({ length: 30 }).map(() => ({ done: false, notes: '', completedAt: null }));
      saveState();
   }
   renderGrid();

   // Debug helpers (attached to window) — safe to remove in production
   window.__oneandone = {
      getState: () => JSON.parse(JSON.stringify(state)),
      reset: resetChallenge,
      save: saveState,
      load: loadState
   };
});