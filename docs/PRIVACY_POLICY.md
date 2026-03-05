# Privacy Policy (reference)

The privacy policy is displayed **in-app** at the `/privacy` route and is populated from **frontend build-time configuration**. It describes what data OpenFitLab collects, how it is used, retention, your rights (access, export, erasure, portability, objection), and contact information.

**Operator configuration:** Contact details (email and region) are set via Vite environment variables. See [ARCHITECTURE.md](ARCHITECTURE.md) (Environment Variables → Frontend) and [HOSTING.md](HOSTING.md) (Privacy policy setup). Set `VITE_PRIVACY_EMAIL` and optionally `VITE_PRIVACY_REGION` and `VITE_PRIVACY_LAST_UPDATED` so the in-app policy reflects your instance. Google Analytics is controlled via `VITE_GA_ENABLED` and `VITE_GA_MEASUREMENT_ID`.

**Self-hosting:** If you run your own instance, you are the data controller and responsible for complying with applicable privacy laws (e.g. GDPR, UK DPA). The built-in policy text can be used as a template; consider legal review for your jurisdiction.
