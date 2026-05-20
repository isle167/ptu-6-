# Production Launch Checklist

## Security

- Apply `docs/supabase-rls-checklist.sql` in Supabase.
- Verify anonymous users cannot read or write private user data.
- Verify users can only read/update/delete their own `wrong_notes`, `game_records`, custom `words`, and `profiles`.
- Keep AI provider API keys only in Supabase Edge Functions or server-side code.

## AI Cost Control

- Enforce rate limits server-side, not only in the browser.
- Track daily AI usage by user.
- Add provider timeout and retry policy.
- Monitor failed AI requests and provider latency.

## Product

- Test login, signup, email verification, game play, wrong-note save, custom word save, AI chat, ranking, and stats.
- Test Chrome, Safari, and mobile Safari.
- Check Korean text wrapping on small screens.
- Confirm content data has no duplicate or invalid rows.

## Operations

- Use a production domain with HTTPS.
- Set up analytics and error logging.
- Prepare support contact and incident response process.
- Publish Privacy Policy and Terms of Service before accepting real users.
