# Gestionale Magazzino

## Prova immediata
1. Apri `config.js`.
2. Lascia `DEMO_MODE = true`.
3. Pubblica i file su GitHub Pages.
4. Password demo: `demo1234`.

La modalità demo salva i dati solo nel browser del dispositivo.

## Per renderlo privato e con dati online
1. Crea un progetto Supabase.
2. Esegui `schema.sql` nel SQL Editor.
3. Crea il tuo utente email/password in Supabase Auth.
4. In `config.js` metti:
   - `DEMO_MODE = false`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Pubblica su GitHub Pages.

Non mettere mai una `service_role key` nel codice pubblico del sito.
