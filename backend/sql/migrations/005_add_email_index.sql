-- Add index on user_identities.email to speed up OAuth sign-in email-matching lookups.
CREATE INDEX idx_email ON user_identities (email);
