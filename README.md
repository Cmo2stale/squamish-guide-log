# Squamish Guide Log

An offline trip logbook for fishing guides on the Squamish, Ashlu, Mamquam, Cheakamus and Elaho rivers. Built by Riverside Solutions Inc.

**Open the app:** https://cmo2stale.github.io/squamish-guide-log/

## For guides

1. Open the link once on your phone while you have signal.
2. Add it to your home screen:
   - **iPhone:** in Safari, tap Share, then "Add to Home Screen".
   - **Android:** in Chrome, open the menu, then "Install app" or "Add to Home screen".
3. Open it from the home screen from then on. It works with no cell service.

After each trip, tap **Log a trip** and fill in:
- the date and waterbody
- the people fishing, by residency
- the hours fished
- the fish caught by species (hatchery or wild for chinook and coho), and any salmon kept

You can log several trips in a day.

At the end of the licence year (April to March), tap **Export for the BC report**. You get a spreadsheet (CSV or Excel, your choice) with one row per group and a totals row, laid out in the same order as the province's Freshwater Angling Guide Report web form. **Trip spreadsheet** exports every trip in detail. Both exports cover only the licence year picked in the Season section.

## Your data

Trips are stored only on your phone. There are no accounts and nothing is uploaded. Use **Settings and backup → Save a backup file** every few weeks, and keep the file somewhere safe, such as email or Drive. To move to a new phone, install the app there and choose **Restore from a backup**.

## Notes

- This is a static site with no build step: `index.html`, `styles.css`, `app.js`, and `sw.js` (the offline cache).
- When you change any file, bump `VERSION` in `sw.js` and `APP_VERSION` in `app.js`. Installed copies will then show "A new version of the app is ready".
