# VITALS Demo Script (10-minute Walkthrough)

## 1. Landing Page (30s)
- **Goal**: Explain the problem and show the VITALS value proposition.
- **Action**: Open the homepage. Briefly discuss the challenge of real-time blood inventory tracking and how VITALS connects blood banks, the public, and NGOs.

## 2. Reporter Flow (2min)
- **Goal**: Show how easy it is for staff to update inventory.
- **Action**: Navigate to `/report`. Select a bank, choose "O+ Whole Blood", and enter "5" units. Submit the form.
- **Result**: Show the "Synced ✓" confirmation.

## 3. Offline Demo (2min)
- **Goal**: Demonstrate resilience to network issues (Offline-first architecture).
- **Action**: Open browser DevTools and disable the network (Offline mode). Submit another update (e.g., A- Whole Blood, 10 units).
- **Result**: Point out the "Queued (offline)" status. Re-enable the network. Watch it automatically change to "Synced ✓".

## 4. Public Search (2min)
- **Goal**: Show how patients/public find blood.
- **Action**: Navigate to `/search`. Search for "O+" near "Delhi". 
- **Result**: Show the search results, highlighting the distance (`distance_km`) and freshness (`last_updated`) of the data.

## 5. Dashboard (2min)
- **Goal**: Demonstrate NGO/Admin monitoring capabilities.
- **Action**: Navigate to `/dashboard`. 
- **Result**: Show key metrics, the map of coverage, and specifically point out the "Silent Banks" (stale banks) in red (`dash-stale`).

## 6. SMS Webhook (1min)
- **Goal**: Show accessibility for banks without internet.
- **Action**: Use Postman or `curl` to send a POST request to `/api/sms/webhook` with `Body=O%2B WB 12`.
- **Result**: Show the successful TwiML XML response and verify the update on the `/search` page or database.

## 7. Technical Q&A Prompts (30s)
- **Judge**: "How do you handle concurrent updates?" **Answer**: "The database uses unique constraints on bank/blood_group/component and row-level locks during updates."
- **Judge**: "What happens if the service worker fails?" **Answer**: "The app gracefully degrades to standard online-only API calls."
