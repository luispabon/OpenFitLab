<script lang="ts">
  import { privacyConfig } from '../lib/config/privacy.js';
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
  <h1 class="mb-6 text-3xl font-bold text-text-primary">Privacy Policy</h1>

  <div class="prose prose-invert max-w-none text-text-primary">
    <p class="mb-6 text-sm text-text-secondary">
      Last Updated: {privacyConfig.lastUpdated}
    </p>
    <p class="mb-6 text-sm text-text-secondary">
      <strong>Data Controller:</strong> OpenFitLab Operator ({privacyConfig.region})<br />
      <strong>Contact:</strong> See Contact Information below.
    </p>
    <p class="mb-6 text-sm text-text-secondary">
      This privacy policy applies to the specific OpenFitLab instance you are using. OpenFitLab is
      open-source software that anyone can self-host. Self-hosted instances may have different
      privacy practices.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">1. Introduction</h2>
    <p class="text-text-secondary">
      OpenFitLab is a fitness data visualization and analysis platform. This Privacy Policy explains
      how we collect, use, store, and protect your personal data.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">2. Data We Collect</h2>
    <h3 class="mt-4 text-lg font-medium text-text-primary">2.1 Account Information</h3>
    <p class="text-text-secondary">
      When you sign in using Google or GitHub OAuth, we collect: display name, email address
      (verified), avatar URL, OAuth provider name, and provider user ID. You may link multiple OAuth
      providers to the same account if the email addresses match.
    </p>
    <h3 class="mt-4 text-lg font-medium text-text-primary">2.2 Fitness and Activity Data</h3>
    <p class="text-text-secondary">
      When you upload workout files (TCX, FIT, GPX, JSON, SML), we store event metadata, activity
      details (sport type, device name), statistics (duration, distance, heart rate, pace, etc.),
      and time-series stream data (GPS, heart rate, elevation, speed). Original uploaded files are
      parsed and immediately discarded; we do not retain the raw files.
    </p>
    <h3 class="mt-4 text-lg font-medium text-text-primary">2.3 Saved Comparisons</h3>
    <p class="text-text-secondary">
      Comparison names, settings, and event associations are stored when you create comparisons.
    </p>
    <h3 class="mt-4 text-lg font-medium text-text-primary">2.4 Session Data</h3>
    <p class="text-text-secondary">
      We maintain server-side session cookies to keep you logged in. These expire after 7 days of
      inactivity.
    </p>
    {#if privacyConfig.hasAnalytics}
      <h3 class="mt-4 text-lg font-medium text-text-primary">2.5 Analytics Data</h3>
      <p class="text-text-secondary">
        We use Google Analytics to understand how visitors use our application (page views,
        device/browser information, approximate location, session duration, referrer). We have
        configured IP anonymization, disabled advertising features, and limited data retention to 14
        months. We do not track individual fitness data.
      </p>
    {/if}

    <h2 class="mt-8 text-xl font-semibold text-text-primary">3. How We Use Your Data</h2>
    <p class="text-text-secondary">
      We use your data to display activities and comparisons, calculate aggregates and charts,
      enable side-by-side comparisons, and authenticate your session. Analytics data (when enabled)
      is used for service improvement, performance monitoring, and capacity planning.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">4. Legal Basis (GDPR)</h2>
    <p class="text-text-secondary">
      Account and fitness data are processed under Contract (Art. 6(1)(b)). Analytics and security
      logs are processed under Legitimate Interest (Art. 6(1)(f)). You may object to analytics via
      Account Settings or browser tools.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">5. Data Retention</h2>
    <p class="text-text-secondary">
      Account and fitness data are retained until you delete your account or the individual event.
      Sessions expire after 7 days of inactivity. Analytics data is retained for 14 months. Deleted
      data is permanently removed; backups may retain data for up to 30 days.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">6. Third-Party Services</h2>
    <p class="text-text-secondary">
      We use Google and GitHub OAuth for authentication (profile, email, avatar). We use OpenFreeMap
      for map tiles and Google Fonts for icons. No personal data is shared with map or font
      services.
    </p>
    {#if privacyConfig.hasAnalytics && privacyConfig.analyticsConfig}
      <p class="mt-2 text-text-secondary">
        Google Analytics 4: IP anonymization enabled, advertising disabled, 14-month retention. Data
        may be processed on US servers (EU-US Data Privacy Framework). You can opt out via Account
        Settings, the
        <a
          href="https://tools.google.com/dlpage/gaoptout"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent hover:underline">Google opt-out add-on</a
        >, Do Not Track, or ad blockers.
      </p>
    {/if}

    <h2 class="mt-8 text-xl font-semibold text-text-primary">
      7. Your Data Rights (GDPR / UK DPA)
    </h2>
    <p class="text-text-secondary">
      You have the right to access (export data), rectification, erasure (delete account), data
      portability, and to object to or restrict processing. Export and delete account are available
      under Account Settings. Contact us (below) for other requests.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">8. International Transfers</h2>
    <p class="text-text-secondary">
      Data may be processed in the United Kingdom and (for analytics) the United States. We rely on
      the EU-US Data Privacy Framework and IP anonymization for US transfers.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">9. What We Don't Do</h2>
    <p class="text-text-secondary">
      We do not advertise, sell data, or share your fitness data with third parties. All fitness
      data is private and requires authentication. Analytics (when enabled) tracks only page-level
      usage, not your fitness data.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">10. Security</h2>
    <p class="text-text-secondary">
      We use HTTPS, secure session cookies, CSRF protection, rate limiting, and strict data
      isolation. Server administrators are bound by this policy.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">11. Cookies</h2>
    <p class="text-text-secondary">
      We use an essential session cookie (ofl.sid, 7 days). When analytics is enabled, we use Google
      Analytics cookies; you can opt out as described above.
    </p>

    <h2 class="mt-8 text-xl font-semibold text-text-primary">12. Contact Information</h2>
    {#if privacyConfig.email}
      <p class="text-text-secondary">
        For privacy questions, data export/deletion, or to exercise your rights:<br />
        <strong>Email:</strong>
        <a href="mailto:{privacyConfig.email}" class="text-accent hover:underline"
          >{privacyConfig.email}</a
        ><br />
        <strong>Region:</strong>
        {privacyConfig.region}<br />
        We aim to respond within 30 days. For complaints, you may contact the
        <a
          href="https://ico.org.uk/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent hover:underline">Information Commissioner's Office (ICO)</a
        >.
      </p>
    {:else}
      <p class="text-text-secondary">
        Contact email is not configured for this instance. Region: {privacyConfig.region}. For
        complaints, you may contact the
        <a
          href="https://ico.org.uk/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent hover:underline">ICO</a
        >.
      </p>
    {/if}

    <h2 class="mt-8 text-xl font-semibold text-text-primary">13. Changes to This Policy</h2>
    <p class="text-text-secondary">
      We may update this policy from time to time. The "Last Updated" date will be revised.
      Significant changes may be announced by email. Continued use after changes constitutes
      acceptance.
    </p>
  </div>
</div>
